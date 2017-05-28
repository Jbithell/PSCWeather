import os
import serial

emptyvar = "" #Sometimes you have to assign a serial read to this to stop it being ignored - so I'll go ahead and do that but don't ask my why

def log(message):
    print(message)

serialport = os.environ.get('serialPort', '/dev/ttyUSB0')
baudrate = os.environ.get('baudRate', 19200) #Set the Baudrate to 19200 which is a nice default for the davis logger
try:
    ser = serial.Serial(serialport, baudrate, timeout=2)  # Open a serial connection
    ser.isOpen()
except Exception as e:
    print(e)
    log("Cannot find device in serial port or open a connection")
    if (os.getenv('rebootOnSerialFail', "True") == "True"):
        os.system("reboot")  # Reboot the device if cannot connect to serial port - ie have a second attempt


print("Sending loop command")
ser.write(bytes(str("LOOP 1 \n"), 'utf8'))
print("Sent")
ser.readline() #Read this line but ignore it - it is just some info to tell you all is well
ser.readline() #Read this line but ignore it - it is just some info to tell you all is well
response = ser.readline()
data = {}
data["humidity"] = response[34] #As a percentage
data["temperature"] = response[13] #In degrees F multiplied by 10
data["windspeed"] = response[15] #In mph
data["wind10minaverage"] = response[16] #In mph - and average of the last 10 minutes
data["winddirection"] = response[17:18] #In degrees
print(data)
emptyvar = ser.readline() #Read this line but ignore it - it is boring data we don't want

print("Program done")
