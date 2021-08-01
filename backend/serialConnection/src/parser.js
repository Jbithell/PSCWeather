const logger = require("./logger")
/**
 * Script to parse a buffer of the format "loop" and turn it into to an object
 * @param {Buffer} inputBuffer
 */
const parser = (inputBuffer) => {
  if (inputBuffer.length < 94) {
    logger.log("warn",`Buffer received too short - length is ${inputBuffer}`,inputBuffer)
    return false
  } else if (inputBuffer.slice(0,3).toString('utf8') !== "LOO") {
    logger.log("warn","Buffer received doesn't start with LOO (76,79,79)",inputBuffer)
    return false
  }
  const data = {
    temperatureRaw: inputBuffer.readUInt16LE(12), // In degrees F multiplied by 10
    windDirection: inputBuffer.readUInt16LE(16), //In degrees
    barometer: inputBuffer.readUInt16LE(7), // In Hg/1000
    windSpeed: (inputBuffer.readUInt8(14) / 10).toFixed(1), // in MPH
    wind10MinAverage: (inputBuffer.readUInt16LE(18) / 10).toFixed(1), // in MPH - an average of the last 10 minutes
    wind2MinAverage: (inputBuffer.readUInt16LE(20) / 10).toFixed(1), // in MPH - an average of the last 2 minutes
    windGust: (inputBuffer.readUInt16LE(22) / 10).toFixed(1), // in MPH - gust of the last 10 minutes
    humidity: inputBuffer.readUInt8(33), // in %
    timestamp: new Date().toISOString(),
  }
  data.temperatureF = (data.temperatureRaw / 10).toFixed(1) // Temperature in degrees F
  data.temperatureC = ((data.temperatureRaw - 32)*(5/9)).toFixed(1) // Temperature in degrees C
  if (data.windDirection < 1 || data.windDirection > 360) {
    logger.log("warn","Wind direction out of range")
    return false
  }
  return data
}
module.exports = parser