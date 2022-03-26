const SerialPort = require('serialport')
const Delimiter = require('@serialport/parser-delimiter')
const logger = require("./logger")
const responseParser = require("./parser")
const responseValidator = require("./validator")
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
/***
 * Cache the serial connection as the messages can come through from the device in chunks
 */
let serialCache = { 
  "cache": Buffer.from([]),
  "updated": Date.now()
}
function cacheSerial(message) { //Build up a bit of a cache of serial messages because they seem to come in chunks
  if (serialCache["updated"] < (Date.now() - 65000)) { //If the cache is older than 65 seconds
    logger.log("warn","Resetting cache (out of date)", serialCache)
    serialCache["cache"] = Buffer.from([]) //Reset the cache
  }
  serialCache["updated"] = Date.now()
  serialCache["cache"] = Buffer.concat([serialCache["cache"],message]) //Add the new message to the cache

  let offset = responseValidator(serialCache["cache"]) //Check if the cache is a complete message
  if (offset !== false) { // If we have a full message then parse it, otherwise wait and let the cache build up a bit
    const response = responseParser(serialCache["cache"], offset) //Parse the message
    serialCache = { //Reset the serialCache
      "cache": Buffer.from([]),
      "updated": Date.now()
    }
    if (response) {
      logger.log("debug","Received parsed weather data", response)
      windy(response) // Send the data to windy
      windguru(response) // Send the data to windguru
    }
  }
}
/**
 * Handle messages from the device
 */
parser.on('data', function(message) {
  if (notHeadFromDevice) {
    notHeadFromDevice = false
    querySerial() // Trigger the first query, function then starts calling itself
  }
  cacheSerial(message)
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