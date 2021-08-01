const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

//Setup Serial connection
const port = new SerialPort('/dev/ttyUSB0', {baudRate=19200})
const parser = port.pipe(new Readline({ delimiter: '\n' }))
port.on('error', function(err) {
  console.log('Error: ', err.message)
})
function serialWrite(message) {
  return new Promise(function(resolve, reject) {
      port.write(message, function(err) {
        if (err) {
          console.log('Error on writing to Serial: ', err.message)
          reject();
        } else {
          resolve();
        }
      })
  });
}
serialWrite("BAUD 19200 \n").then(() => {
  console.log("Wrote to serial");
})

parser.on('data', console.log)
