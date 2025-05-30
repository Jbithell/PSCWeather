const logger = require("./logger");
/**
 * Script to parse a buffer of the format "loop" and turn it into to an object
 * @param {Buffer} inputBuffer
 */
const parser = (inputBuffer, offset) => {
  const data = {
    barTrend: inputBuffer.readInt8(offset + 3), // current 3-hour barometer trend
    barometer: inputBuffer.readUInt16LE(offset + 7), // In Hg/1000
    temperatureF: (inputBuffer.readUInt16LE(offset + 12) / 10).toFixed(1), // In degrees F multiplied by 10
    windSpeed: inputBuffer.readUInt8(offset + 14).toFixed(1), // in MPH
    windDirection: inputBuffer.readUInt16LE(offset + 16), //In degrees
    wind10MinAverage: (inputBuffer.readUInt16LE(offset + 18) / 10).toFixed(1), // in MPH - an average of the last 10 minutes
    wind2MinAverage: (inputBuffer.readUInt16LE(offset + 20) / 10).toFixed(1), // in MPH - an average of the last 2 minutes
    windGust: (inputBuffer.readUInt16LE(offset + 22) / 10).toFixed(1), // in MPH - gust of the last 10 minutes
    windGustDirection: inputBuffer.readUInt16LE(offset + 24).toFixed(1),
    dewPoint: inputBuffer.readInt16LE(offset + 30), // In Degrees F (255 = unavailable)
    humidity: inputBuffer.readUInt8(offset + 33), // in %
    rainRate: (inputBuffer.readUInt16LE(offset + 34) * 0.2).toFixed(1), // in mm
    uv: inputBuffer.readUInt8(offset + 43), // UV index
    solarRadiation: inputBuffer.readUInt16LE(offset + 44), // in W/m2
    last15MinRain: (inputBuffer.readUInt16LE(offset + 52) * 0.2).toFixed(1), // in mm
    lastHourRain: (inputBuffer.readUInt16LE(offset + 54) * 0.2).toFixed(1), // in mm
    last24HourRain: (inputBuffer.readUInt16LE(offset + 58) * 0.2).toFixed(1), // in mm
    timestamp: new Date().toISOString(),
  };
  data.temperatureC = ((parseFloat(data.temperatureF) - 32) * (5 / 9)).toFixed(
    1
  ); // Temperature in degrees C
  data.disregardReason = "";
  if (data.windDirection < 1 || data.windDirection > 360) {
    data.disregardReason = "Wind direction out of range";
    logger.log("warn", "Wind direction out of range", data);
  } else if (data.windSpeed == 255 && data.humidity == 255) {
    data.disregardReason =
      "Wind speed and humidity are 255 - console is in setup mode";
    logger.log(
      "warn",
      "Wind speed and humidity are 255 - console is in setup mode"
    );
  } else if (
    data.windSpeed > 150 ||
    data.temperatureC > 60 ||
    data.humidity > 100
  ) {
    data.disregardReason = "Wind speed/temperature/humidity are too high";
    logger.log(
      "warn",
      "Data is weird - wind speed/temperature/humidity are too high"
    );
  }
  return data;
};
module.exports = parser;
