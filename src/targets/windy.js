const logger = require("./../logger");

// Function to send weather data to Windy
const windy = (weatherData) => {
  if (!process.env.WINDY_API_KEY || !process.env.WINDY_STATION_ID) return;

  const params = new URLSearchParams({
    station: process.env.WINDY_STATION_ID, // 32 bit integer; required for multiple stations; default value 0; alternative names: si, stationId
    ts: Math.floor(new Date().getTime()), // unix timestamp [s] or [ms]
    temp: weatherData.temperatureC, // real number [°C]; air temperature
    //wind:"", // real number [m/s]; wind speed
    windspeedmph: weatherData.windSpeed, // real number [mph]; wind speed (alternative to wind)
    winddir: weatherData.windDirection, // integer number [deg]; instantaneous wind direction
    //gust:"", // real number [m/s]; current wind gust
    windgustmph: weatherData.windGust, // real number [mph]; current wind gust (alternative to gust)
    rh: weatherData.humidity, // real number [%]; relative humidity ; alternative name: humidity
    //dewpoint:"", // real number [°C];
    //pressure:"", // real number [Pa]; atmospheric pressure
    //mbar:"", // real number [milibar, hPa]; atmospheric pressure alternative
    //baromin:"", // real number [inches Hg]; atmospheric pressure alternative
    //precip:"", // real number [mm]; precipitation over the past hour
    //rainin:"", // real number [in]; rain inches over the past hour (alternative to precip)
    //uv:"" //number [index];
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  fetch(
    `https://stations.windy.com/pws/update/${
      process.env.WINDY_API_KEY
    }?${params.toString()}`,
    {
      method: "GET",
      signal: controller.signal,
    }
  )
    .then((response) => response.text())
    .then((data) => {
      clearTimeout(timeout);
      logger.log("http", "Sent request to windy", data);
    })
    .catch((error) => {
      logger.log("error", "Error from windy", error.message);
    });
};

module.exports = windy;
