import os
import serial
import sys #To quit program
import time #For time.sleep
import struct #To merge two bytes in an integer
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
    log("[INFO] Sending a loop request")
    ser.write(bytes(str("LOOP 1 \n"), 'utf8'))
    response = b""
    for i in range(4):
        response = response + ser.readline()
    data = {}
    try:
        print(response[13])
        print(response[14])
        print(struct.unpack('>B', response[13:14], response[14:15]))
        #data["temperature"] = (((response[13]/10)-32)*(5/9)) #In degrees F multiplied by 10, converted into C
        data["temperature"] = response[14]  # In degrees F multiplied by 10
        data["windspeed"] = response[15] #In mph
        data["wind10minaverage"] = response[16] #In mph - and average of the last 10 minutes
        data["winddirection"] = response[18] #In degrees
    except Exception as e:
        log("[ERROR] Ignoring data because of error: " + str(e))
        return False

    if data["windspeed"] == 0 and data["winddirection"] == 0: #This indicates it's struggling for data so ignore
        log("[INFO] Ignoring data because of 0 wind direction and speed")
        return False
    elif data["windspeed"] == 255 and data["wind10minaverage"] == 255:
        log("[INFO] Ignoring data because of 255 direction, speed and average")
        return False #Ignore - it's normally an offset error
    return data

while True:
    data = looprequest()
    if data:
        print(data)
    time.sleep(10)

log("[INFO] End of Program")
