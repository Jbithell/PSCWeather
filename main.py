import os
import serial
def log(message):
    print(message)

serialport = os.environ.get('serialPort', '/dev/serial0')
baudrate = os.environ.get('baudRate', 19200) #Set the Baudrate to 19200 which is a nice default for the davis logger
try:
    ser = serial.Serial(serialport, baudrate)  # Open a serial connection
    ser.open()
except:
    log("Cannot find device in serial port or open a connection")
    if (os.getenv('rebootOnSerialFail', True)):
        os.system("shutdown /r")  # Reboot the device if cannot connect to serial port - ie have a second attempt

ser.write(("LOOP 1" + "\n").encode('ascii'))
print(ser.readline())
print(ser.name)
