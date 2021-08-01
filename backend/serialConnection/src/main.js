const SerialPort = require('serialport')
const Delimiter = require('@serialport/parser-delimiter')
const logger = require("./logger")
const responseParser = require("./parser")
const sleep = require("./sleep")
logger.log("info","Booted")
/**
 * Setup the serial connection
 */
const port = new SerialPort('/dev/ttyUSB0', { "baudRate":19200 })
const parser = port.pipe(new Delimiter({ delimiter: Buffer.from("\n\r",'utf-8'), includeDelimiter: false}))
port.on('error', function(error) {
  logger.log("error",error)
})
function serialWrite(message) {
  const newMessage = Buffer.from(message + "\n", 'utf-8')
  return new Promise(function(resolve, reject) {
      port.write(newMessage, function(error) {
        if (error) {
          logger.log("error",error)
          reject()
        } else {
          logger.log("debug",`Wrote ${newMessage} to Serial Connection`)
          resolve()
        }
      })
  })
}

/**
 * Logic to query the serial device
 */
function querySerial() {
  serialWrite("").then(() => { //Send a newline to wake up the device
    sleep(500) //Wait half a second for wake up
  }).then(() => {
    serialWrite("LPS 2 1") //Send the loop command
  }).then(() => {
    sleep(5000) // Wait 5 seconds as the data isn't that exciting
  }).then(() => {
    querySerial() //Request again
  })
}
parser.on('data', function(message) {
  if (notHeadFromDevice) {
    notHeadFromDevice = false
    querySerial() // Trigger the first query, function then starts calling itself
  }
  console.log(responseParser(message))
  logger.log("debug",`Message from Serial Connection Parser`, message)
})


/**
 * At boot, we want to nudge the device a fair bit to get it to connect
 */
let notHeadFromDevice = true
function connectToDevice() {
  if (notHeadFromDevice) {
    serialWrite("BAUD 19200").then(() => {
      serialWrite("") //An empty newline
    }).then(() => {
      sleep(2000)
    }).then(() => {
      connectToDevice()
    })
  }
}
connectToDevice()