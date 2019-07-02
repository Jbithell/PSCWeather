import os
import sys #To kill app
import serial
import time #For time.sleep
import struct #To merge two bytes in an integer
import urllib.parse #For encoding datainternet
import urllib.request #For internet
import json #To parse response
import sqlite3 #Database
import pusher #Pusher.com

os.environ['TZ'] = 'Europe/London' #SetTimezone
def log(message):
    print(message)

while os.environ.get('onlineButDormant', False) == "True":
    #onlineButDormant, if set, makes the device do nothing except log the statement below every 12 hours. To get in/out of this mode, set the env paramater and restart the container
    log("SleepMode for closure")
    time.sleep(43200) #12 Hours

def reboot():
    #Use Resin.io api to reboot
    log("Rebooting")
    rebooturl = str(os.environ.get('BALENA_SUPERVISOR_ADDRESS')) + '/v1/reboot?apikey=' + str(os.environ.get('BALENA_SUPERVISOR_API_KEY'))
    os.system('curl -X POST --header "Content-Type:application/json" "' + rebooturl + '"')
    time.sleep(60) #Just in case that api call fails as it sometimes does
    os.system('curl -X POST --header "Content-Type:application/json" "' + rebooturl + '"')
    time.sleep(60)  # Just in case that api call fails AGAIN as it sometimes does
    reboot()
    return False

serialport = "/dev/ttyUSB0"
baudrate = os.environ.get('baudRate', 19200) #Set the Baudrate to 19200 which is a nice default for the davis logger
try:
    ser = serial.Serial(serialport, baudrate, timeout=2)  # Open a serial connection
    ser.isOpen()
except Exception as e:
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
            if (os.getenv('rebootOnSerialFail', "True") == "True"):
                log("[INFO] Rebooting")
                reboot()  # Reboot the device if cannot connect to serial port - ie have a second attempt
            else:
                log("[INFO] Quitting")
ser.readline() #Read the /r character that follows but ignore it

log("[INFO] Connecting to Pusher")
pusher_client = pusher.Pusher(
  app_id=os.environ.get('PUSHERappid'),
  key=os.environ.get('PUSHERkey'),
  secret=os.environ.get('PUSHERsecret'),
  cluster='eu',
  ssl=True
)
log("[INFO] Connected to Pusher")


log("[INFO] Ready to start getting data")
previousworkingresponse = "" #Global var
errorcount = 0
windSpeeds = {} #Format: timestamp:windSpeedAtThatInstant
def looprequest():
    global previousworkingresponse, errorcount, windSpeeds
    ser.write(bytes(str("LOOP 1 \n"), 'utf8')) #Send a request to the data logger
    response = b""
    for i in range(4):
        response = response + ser.readline()
    data = {}
    thisresponse = response
    #if (len(thisresponse) < 100):
    #    log("[ERROR] Data too short")
    #    errorcount = errorcount + 1
    #    return False
    if (len(response) < 1) or (int(response[0]) != 6):
        log("[ERROR] Device failed to respond with ASCII ACK")
        errorcount = errorcount + 1
        # Didn't respond with an Ascii acknowlegement
        return False

    for key in list(windSpeeds.keys()): #Remove items that are older than 5 minutes from the list of gust speeds
        if int(key) < (time.time()-300):
            del windSpeeds[key]
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

        windSpeeds[str(int(round(time.time())))] = data["windSpeed"] #add this data point to the gust speeds list
        data["wind10MinGust"] = max(windSpeeds.values()) #Return the largest value in the dictionary
    except Exception as e:
        log("[ERROR] Ignoring data because of error: " + str(e))
        errorcount = errorcount + 1
        return False

    #print(str(chr(response[1])) + str(chr(response[2])) + str(chr(response[3]))) #Should be LOO

    if data["windSpeed"] > 80 or data["temperatureC"] > 50 or data["humidity"] > 100 or data["windDirection"] > 360:
        log("[INFO] Ignoring data because it's a bit wierd")
        return False
    elif data["windSpeed"] == 0 and data["windDirection"] == 0: #This indicates it's struggling for data so ignore
        log("[INFO] Ignoring data because of 0 wind direction and speed")
        errorcount = errorcount + 1
        return False
    elif data["windSpeed"] == 255 and data["wind10MinAverage"] == 255: #This happens when console in setup mode
        log("[ERROR] CONSOLE IN SETUP MENU (Ignoring data because of 255 direction, speed and average)")
        errorcount = errorcount + 1
        return False #Ignore - there's very little we can do remotely :(
    else:
        if data["wind10MinAverage"] == 255:
            data["wind10MinAverage"] = data["windSpeed"]
            errorcount = errorcount + 1
        previousworkingresponse = thisresponse
        return data


lastSentToServerTime = 0  # Make a request immediately

while True:
    data = looprequest()
    if data:
        if (time.time()-lastSentToServerTime) > int(os.environ.get('serverSendFrequency', 60)): #Send the server a reading every minute
            try:
                requestPayload = urllib.parse.urlencode(data)
                request = urllib.request.Request("https://" + str(os.environ.get('uploadUrl', '')) + "?" + str(requestPayload))
                with urllib.request.urlopen(request) as response:
                    responseText = response.read().decode('utf-8')
                    requestParsedResponse = json.loads(responseText)
                if requestParsedResponse["success"] is not True:
                    log("[ERROR] Couldn't upload the data online - server rejected with " + str(requestParsedResponse["message"]) + " | " + str(response))
                else:
                    lastSentToServerTime = time.time()
                    log("[SUCCESS] Sent Data to WebServer")
            except Exception as e:
                log("[ERROR] Couldn't upload data online " + str(e))
        try:
            pusher_client.trigger('PSCWeatherDataLive', 'PSCWeatherDataLiveNEWReading', {'message': {'reading': data}})
            log("[SUCCESS] Sent Data to Pusher.com")
        except Exception as e:
            log("[ERROR] Couldn't upload data to Pusher " + str(e))
            reboot()

    if errorcount > 5: #If it's hit an error more than 5 times just reboot it
        reboot()

    time.sleep(0.5) #Only take a reading every half second

log("[INFO] End of Program")