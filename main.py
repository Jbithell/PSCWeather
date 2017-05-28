import os
import serial
import sys #To quit program
import time #For time.sleep
from time import gmtime, strftime #For current time
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
log("[INFO] Current time " + str(strftime("%Y-%m-%d %H:%M:%S", gmtime())))
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
    log("[INFO] Sending a loop request")
    ser.write(bytes(str("LOOP 1 \n"), 'utf8'))
    response = ser.readline()
    while len(response) < 50: #Rudimentary offset error handling
        response = ser.readline()
    data = {}
    data["temperature"] = response[13] #In degrees F multiplied by 10
    data["windspeed"] = response[15] #In mph
    data["wind10minaverage"] = response[16] #In mph - and average of the last 10 minutes
    data["winddirection"] = response[17] #In degrees
    ser.readline() #Read this line but ignore it - it is boring data we don't want
    ser.readline()  # Read this line but ignore it - it is boring data we don't want
    if data["windspeed"] == 0 and data["winddirection"] == 0: #This indicates it's struggling for data so ignore
        return False
    return data


while True:
    print(looprequest())
    time.sleep(30)

log("[INFO] End of Program")
