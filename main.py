import os
import serial
import time #For time.sleep
import struct #To merge two bytes in an integer
import urllib.parse #For encoding datainternet
import urllib.request #For internet
import json #To parse response
import sqlite3 #Database
from raven import Client #error reporting

#Ssetup raven - as a client to sentry.io
errorclient = Client('https://14a0ef31e08949a4a864cdd75e6e944c:6b612136599649608bcdb22b2afcff09@sentry.io/181881')

def reboot():
    #Use Resin.io api to reboot
    requestResponse = urllib.request.urlopen(str(os.environ.get('RESIN_SUPERVISOR_ADDRESS')) + '/v1/reboot?apikey=' + str(os.environ.get('RESIN_SUPERVISOR_API_KEY')))
    requestParsedResponse = json.loads(requestResponse.read().decode('utf-8'))
    if requestParsedResponse["Data"] != "OK":
        print(requestParsedResponse["Error"])

os.environ['TZ'] = 'Europe/London' #SetTimezone
def log(message):
    global errorclient
    print(message)


sqliteconn = sqlite3.connect("/data/weatherdatabase.sqlite3")

serialport = os.environ.get('serialPort', '/dev/ttyUSB0')
baudrate = os.environ.get('baudRate', 19200) #Set the Baudrate to 19200 which is a nice default for the davis logger
try:
    ser = serial.Serial(serialport, baudrate, timeout=2)  # Open a serial connection
    ser.isOpen()
except Exception as e:
    errorclient.captureException()
    log(e)
    log("[ERROR] Cannot find device in serial port or open a connection")
    if (os.getenv('rebootOnSerialFail', "True") == "True"):
        log("[INFO] Rebooting")
        reboot()  # Reboot the device if cannot connect to serial port - ie have a second attempt
    else:
        log("[INFO] Quitting")
        reboot()
log("[INFO] Current time " + str(time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())))
log("[INFO] Opening a connection to the weather station")
ser.write(bytes(str("\n"), 'utf8'))
if ser.readline() == b"\n":
    log("[ERROR] Error getting connection - trying again")
    ser.write(bytes(str("\n"), 'utf8'))
    if ser.readline() == b"\n":
        log("[ERROR] Error getting connection - trying again one last time")
        ser.write(bytes(str("\n"), 'utf8'))
        if ser.readline() == b"\n": #Retry
            log("[ERROR] Error getting connection - rebooting if setting is set")
            errorclient.captureMessage("[ERROR] Error getting connection - rebooting if setting is set")
            if (os.getenv('rebootOnSerialFail', "True") == "True"):
                log("[INFO] Rebooting")
                reboot()  # Reboot the device if cannot connect to serial port - ie have a second attempt
            else:
                log("[INFO] Quitting")
ser.readline() #Read the /r character that follows but ignore it

log("[INFO] Ready to start getting data")
previousworkingresponse = "" #Global var
errorcount = 0
def looprequest():
    global previousworkingresponse, errorcount, errorclient
    #log("[INFO] Sending a loop request")
    ser.write(bytes(str("LOOP 1 \n"), 'utf8')) #Send a request to the data logger
    response = b""
    for i in range(4):
        response = response + ser.readline()
    data = {}
    thisresponse = response
    try:
        data["temperatureRaw"] = struct.unpack('<H', response[13:15])[0]  # In degrees F multiplied by 10
        data["temperatureC"] = round((((int(data["temperatureRaw"])/10)-32)*(5/9)), 1) #Converted into C into 1 dp
        data["windSpeed"] = response[15] #In mph
        data["wind10MinAverage"] = response[16] #In mph - and average of the last 10 minutes
        data["windDirection"] = struct.unpack('<H', response[17:19])[0] #In degrees
        data["barometer"] = struct.unpack('<H', response[8:10])[0]  # Hg/1000
        data["humidity"] = response[34] # Outside - %
        data["consoleBattery"] = round((((int(struct.unpack('<H', response[88:90])[0])*300)/512)/100), 1) #In volts
        data["timestamp"] = round(time.time(),0)
    except Exception as e:
        errorclient.captureException()
        errorclient.captureMessage(str(e))
        log("[ERROR] Ignoring data because of error: " + str(e))
        return False

    print(str(response[0]) + str(response[1]) + str(response[2])) //Should be LOO

    if data["windSpeed"] > 80 or data["temperatureC"] > 50 or data["humidity"] > 100:
        log("[INFO] Ignoring data because it's a bit wierd")
        errorclient.captureMessage("[INFO] Ignoring data because it's a bit wierd")
        return False
    elif data["windSpeed"] == 0 and data["windDirection"] == 0: #This indicates it's struggling for data so ignore
        log("[INFO] Ignoring data because of 0 wind direction and speed")
        errorclient.captureMessage("[INFO] Ignoring data because of 0 wind direction and speed")
        errorcount = errorcount + 1
        return False
    elif data["windSpeed"] == 255 and data["wind10MinAverage"] == 255: #This happens when console in setup mode
        log("[ERROR] CONSOLE IN SETUP MENU (Ignoring data because of 255 direction, speed and average)")
        errorclient.captureMessage("Device in Setup Menu")
        return False #Ignore - there's very little we can do remotely :(
    else:
        if (data["wind10MinAverage"] == 255):
            data["wind10MinAverage"] = data["windSpeed"]
            errorcount = errorcount + 1
            errorclient.captureMessage("Wind 10minute average is 255") #This happens when the device is just starting up and hasn't yet been run for 10 minutes
        previousworkingresponse = thisresponse
        return data
def storefailedrequest(data): #Cache all the requests that didn't work
    global sqliteconn
    cursor = sqliteconn.cursor()
    cursor.execute('INSERT INTO `weatherData`(`id`,`timestamp`,`windSpeedMPH`,`windSpeed10MinAverageMPH`,`windDirection`,`temperatureC`,`humidity`,`barometer`) VALUES (NULL,' + str(data["timestamp"]) + ',' + str(data["windSpeed"]) + ',' + str(data["wind10MinAverage"]) + ',' + str(data["windDirection"]) + ',' + str(data["temperatureC"]) + ',' + str(data["humidity"]) + ',' + str(data["barometer"]) + ');')
    cursor.commit()
    cursor.close()

while True:
    data = looprequest()
    if data:
        try:
            requestPayload = urllib.parse.urlencode(data).encode("utf-8")
            requestResponse = urllib.request.urlopen(os.environ.get('uploadUrl', ''), requestPayload)
            requestParsedResponse = json.loads(requestResponse.read().decode('utf-8'))
            if requestParsedResponse["success"] != True:
                log("[ERROR] Couldn't upload the data online - server rejected with " + str(requestParsedResponse["message"]))
                #storefailedrequest(data)
        except Exception as e:
            errorclient.captureException()
            log("[ERROR] Couldn't upload data online " + str(e))
            #storefailedrequest(data)
    if errorcount > 5: #If it's hit an error more than 5 times just reboot it
        reboot()

    time.sleep(2)

log("[INFO] End of Program")