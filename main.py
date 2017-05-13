import os
import serial
serialport = os.environ.get('serialport', '/dev/serial0')
baudrate = os.environ.get('baudrate', 19200)
ser = serial.Serial(serialport,baudrate)
ser.open()
ser.write("LOOP 1" + "\n")
print(ser.name)
