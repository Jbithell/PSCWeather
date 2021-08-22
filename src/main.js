const SerialPort = require('serialport')
const Delimiter = require('@serialport/parser-delimiter')
const logger = require("./logger")
const responseParser = require("./parser")
const sleep = require("./sleep")
const windy = require("./targets/windy")
const windguru = require("./targets/windguru")

logger.log("info","Booted - connecting to Serial")
/**
 * Setup the serial connection
 */
const port = new SerialPort('/dev/ttyUSB0', { "baudRate":19200, autoOpen: true })
const parser = port.pipe(new Delimiter({ delimiter: Buffer.from("\n",'utf-8'), includeDelimiter: false}))
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
    return sleep(500) //Wait half a second for wake up
  }).then(() => {
    return serialWrite("LPS 2 1") //Send the loop command
  }).then(() => {
    return sleep(30000) // Wait 30 seconds as the data isn't that exciting
  }).then(() => {
    querySerial() //Request again
  })
}
parser.on('data', function(message) {
  if (notHeadFromDevice) {
    notHeadFromDevice = false
    querySerial() // Trigger the first query, function then starts calling itself
  }
  const response = responseParser(message)
  if (response) {
    logger.log("debug","Received parsed weather data", response)
    windy(response)
    windguru(response)
  }
})


/**
 * At boot, we want to nudge the device a fair bit to get it to connect
 */
let notHeadFromDevice = true
function connectToDevice() {
  if (notHeadFromDevice) {
    serialWrite("BAUD 19200").then(() => {
      return serialWrite("") //An empty newline
    }).then(() => {
      return sleep(2000)
    }).then(() => {
      connectToDevice()
    })
  }
}
port.on("open", function () {
  logger.log("info","Serial port opened successfully")
  connectToDevice()
})