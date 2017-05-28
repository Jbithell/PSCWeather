import os
import serial
import sys #To quit program
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

log("[INFO] Opening a connection to the weather station")
ser.write(bytes(str("\n"), 'utf8'))
print(ser.readline())
if (ser.readline() != "\n"):
    log("[ERROR] Error getting connection - trying again")
    ser.write(bytes(str("\n"), 'utf8'))
    if (ser.readline() != "\n"):
        log("[ERROR] Error getting connection - rebooting if setting is set")
        if (os.getenv('rebootOnSerialFail', "True") == "True"):
            log("[INFO] Rebooting")
            os.system("reboot")  # Reboot the device if cannot connect to serial port - ie have a second attempt
        else:
            log("[INFO] Quitting")
            #sys.exit()
log("[INFO] Ready to start getting data")

print ("Sending " + str("LOOP 1 \n"))
ser.write(bytes(str("LOOP 1 \n"), 'utf8'))
response = ser.readline()
print(response)
data = {}
data["humidity"] = response[12] #As a percentage - this is the data from inside the clubhouse
data["temperature"] = response[13] #In degrees F multiplied by 10
data["windspeed"] = response[15] #In mph
data["wind10minaverage"] = response[16] #In mph - and average of the last 10 minutes
data["winddirection"] = response[17] #In degrees
print(data)
ser.readline() #Read this line but ignore it - it is boring data we don't want

log("Program done")
