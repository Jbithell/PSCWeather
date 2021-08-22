const axios = require('axios')
const logger = require("./logger")
const windy = (weatherData) => {
  axios({
    method: 'get',
    url: `https://stations.windy.com/pws/update/${process.env.WINDY_API_KEY}`,
    data: {
      station:process.env.WINDY_STATION_ID, // 32 bit integer; required for multiple stations; default value 0; alternative names: si, stationId
      ts:Math.floor(new Date().getTime()), // unix timestamp [s] or [ms]
      temp:weatherData.temperatureC, // real number [°C]; air temperature
      //wind:"", // real number [m/s]; wind speed
      windspeedmph:weatherData.windSpeed, // real number [mph]; wind speed (alternative to wind)
      winddir:weatherData.windDirection, // integer number [deg]; instantaneous wind direction
      //gust:"", // real number [m/s]; current wind gust
      windgustmph:weatherData.windGust, // real number [mph]; current wind gust (alternative to gust)
      rh:weatherData.humidity, // real number [%]; relative humidity ; alternative name: humidity
      //dewpoint:"", // real number [°C];
      //pressure:"", // real number [Pa]; atmospheric pressure
      //mbar:"", // real number [milibar, hPa]; atmospheric pressure alternative
      //baromin:"", // real number [inches Hg]; atmospheric pressure alternative
      //precip:"", // real number [mm]; precipitation over the past hour
      //rainin:"", // real number [in]; rain inches over the past hour (alternative to precip)
      //uv:"" //number [index];
    },
    timeout: 1000,
    responseType: 'text',
  })
  .then(function (response) {
    logger.log("http", "Sent request to windguru", response)
  })
  .catch(function (error) {
    logger.log("error", "Error from windguru", error)
  })
}
module.exports = windy