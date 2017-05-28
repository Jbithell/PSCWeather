import os
import serial
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

log("[INFO] Opening a connection to the weather station")
ser.write(bytes(str("\n"), 'utf8'))
if (ser.readline() != "\n"):
    log("[ERROR] Error getting connection - trying again")
    ser.write(bytes(str("\n"), 'utf8'))
    if (ser.readline() != "\n"):
        log("[ERROR] Error getting connection - rebooting if setting is set")
        if (os.getenv('rebootOnSerialFail', "True") == "True"):
            log("[INFO] Rebooting")
            os.system("reboot")  # Reboot the device if cannot connect to serial port - ie have a second attempt

log("[INFO] Ready to start getting data")

print ("Sending " + str("LOOP 1 \n"))
ser.write(bytes(str("LOOP 1 \n"), 'utf8'))
response = ser.readline()
print(response)
data = {}
data["windspeed"] = response[14]
data["wind10minaverage"] = response[15]
data["winddirection"] = response[16]
print(data)
ser.readline() #Read this line but ignore it - it is boring data we don't want

log("Program done")
