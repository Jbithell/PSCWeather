const logger = require("./logger");
/**
 * Script to parse a buffer of the format "loop" and turn it into to an object
 * @param {Buffer} inputBuffer
 */
const parser = (inputBuffer, offset) => {
  const data = {
    temperatureRaw: inputBuffer.readUInt16LE(offset + 12), // In degrees F multiplied by 10
    windDirection: inputBuffer.readUInt16LE(offset + 16), //In degrees
    barometer: inputBuffer.readUInt16LE(offset + 7), // In Hg/1000
    windSpeed: inputBuffer.readUInt8(offset + 14).toFixed(1), // in MPH
    wind10MinAverage: (inputBuffer.readUInt16LE(offset + 18) / 10).toFixed(1), // in MPH - an average of the last 10 minutes
    wind2MinAverage: (inputBuffer.readUInt16LE(offset + 20) / 10).toFixed(1), // in MPH - an average of the last 2 minutes
    windGust: (inputBuffer.readUInt16LE(offset + 22) / 10).toFixed(1), // in MPH - gust of the last 10 minutes
    humidity: inputBuffer.readUInt8(offset + 33), // in %
    timestamp: new Date().toISOString(),
  };
  data.temperatureF = (data.temperatureRaw / 10).toFixed(1); // Temperature in degrees F
  data.temperatureC = ((data.temperatureRaw / 10 - 32) * (5 / 9)).toFixed(1); // Temperature in degrees C
  data.disregardReason = "";
  if (data.windDirection < 1 || data.windDirection > 360) {
    logger.log("warn", "Wind direction out of range", data);
    data.disregardReason = "Wind direction out of range";
  } else if (data.windSpeed == 255 && data.humidity == 255) {
    logger.log(
      "warn",
      "Wind speed and humidity are 255 - console is in setup mode"
    );
    data.disregardReason =
      "Wind speed and humidity are 255 - console is in setup mode";
  } else if (
    data.windSpeed > 150 ||
    data.temperatureC > 60 ||
    data.humidity > 100
  ) {
    logger.log(
      "warn",
      "Data is weird - wind speed/temperature/humidity are too high"
    );
    data.disregardReason = "Wind speed/temperature/humidity are too high";
  }
  return data;
};
module.exports = parser;
