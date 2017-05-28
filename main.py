import os
import serial
import codecs #Decode the strings
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


print ("Sending " + str("\n"))
ser.write(bytes(str("\n"), 'utf8'))
print("Sent ")
print(bytes(str("\n"), 'utf8'))


print ("Sending " + str("LOOP 1 \n"))
ser.write(bytes(str("LOOP 1 \n"), 'utf8'))
print("Sent ")
print(bytes(str("LOOP 1 \n"), 'utf8'))
ser.readline()
response = ser.readline()
print(response)
for byte in response[15:18]:
    print(byte)

print("Program done")
