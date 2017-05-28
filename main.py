import os
import serial
def log(message):
    print(message)

serialport = os.environ.get('serialPort', '/dev/ttyUSB0')
baudrate = os.environ.get('baudRate', 19200) #Set the Baudrate to 19200 which is a nice default for the davis logger
try:
    ser = serial.Serial(serialport, baudrate)  # Open a serial connection
    ser.isOpen()
except Exception as e:
    print(e)
    log("Cannot find device in serial port or open a connection")
    if (os.getenv('rebootOnSerialFail', "True") == "True"):
        os.system("reboot")  # Reboot the device if cannot connect to serial port - ie have a second attempt

def sendcommand(command):
    print ("Sending " + str(command))
    ser.write(bytes(str(command)))
    print("Sent " + bytes(str(command)))
    print(ser.readline())
    print("Command complete")

sendcommand("\n")
sendcommand("TEST \n")
print("Program done")
