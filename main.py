import os
import serial
import sys #To quit program
import time #For time.sleep
import struct #To merge two bytes in an integer
import urllib #For encoding data & internet

os.environ['TZ'] = 'Europe/London' #SetTimezone
def log(message):
    print(message)

serialport = os.environ.get('serialPort', '/dev/ttyUSB0')
baudrate = os.environ.get('baudRate', 19200) #Set the Baudrate to 19200 which is a nice default for the davis logger
try:
    ser = serial.Serial(serialport, baudrate, timeout=2)  # Open a serial connection
    ser.isOpen()
except Exception as e:
    log(e)
    log("[ERROR] Cannot find device in serial port or open a connection")
    if (os.getenv('rebootOnSerialFail', "True") == "True"):
        log("[INFO] Rebooting")
        os.system("reboot")  # Reboot the device if cannot connect to serial port - ie have a second attempt
    else:
        log("[INFO] Quitting")
        sys.exit()
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
                os.system("reboot")  # Reboot the device if cannot connect to serial port - ie have a second attempt
            else:
                log("[INFO] Quitting")
                #sys.exit()
ser.readline() #Read the /r character that follows but ignore it

log("[INFO] Ready to start getting data")

def looprequest():
    #log("[INFO] Sending a loop request")
    ser.write(bytes(str("LOOP 1 \n"), 'utf8'))
    response = b""
    for i in range(4):
        response = response + ser.readline()
    data = {}
    try:
        data["temperatureRaw"] = struct.unpack('<H', response[13:15])[0]  # In degrees F multiplied by 10
        data["temperatureC"] = (((int(data["temperatureRaw"])/10)-32)*(5/9)) #Converted into C
        data["windSpeed"] = response[15] #In mph
        data["wind10MinAverage"] = response[16] #In mph - and average of the last 10 minutes
        data["windDirection"] = struct.unpack('<H', response[17:19])[0] #In degrees
        data["barometer"] = struct.unpack('<H', response[8:10])[0]  # Hg/1000
        data["humidity"] = response[34] # Outside - %
        data["consoleBattery"] = int(struct.unpack('<H', response[88:90])[0]) #Just a test rtn
        data["timestamp"] = time.time()
    except Exception as e:
        log("[ERROR] Ignoring data because of error: " + str(e))
        return False

    if data["windSpeed"] == 0 and data["windDirection"] == 0: #This indicates it's struggling for data so ignore
        log("[INFO] Ignoring data because of 0 wind direction and speed")
        return False
    elif data["windSpeed"] == 255 and data["wind10MinAverage"] == 255:
        log("[INFO] Ignoring data because of 255 direction, speed and average")
        return False #Ignore - it's normally an offset error
    return data

while True:
    data = looprequest()
    if data:
        print(data)
        try:
            requestPayload = urllib.urlencode(data)
            request = urllib.Request(os.environ.get('uploadUrl', ''), requestPayload)
            requestResponse = urllib.urlopen(request).read()
            print(requestResponse)
        except Exception as e:
            log("[ERROR] Couldn't upload data online")

    time.sleep(10)

log("[INFO] End of Program")
