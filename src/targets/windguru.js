const logger = require("./../logger");
const crypto = require("crypto");

// Helper function to generate a random string of a given length
const makeString = (length) => {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

// Function to send weather data to Windguru
const windguru = (weatherData) => {
  if (!process.env.WINDGURU_UID) return;

  const salt = makeString(30);
  const hash = crypto
    .createHash("md5")
    .update(salt + process.env.WINDGURU_UID + process.env.WINDGURU_PASSWORD)
    .digest("hex");

  const params = new URLSearchParams({
    uid: process.env.WINDGURU_UID, // (required)	UID of your station = unique string you chose during station registration
    //interval:"", //measurement interval in seconds (60 would mean you are sending 1 minute measurements), then the wind_avg / wind_max / wind_min values should be values valid for this past interval
    wind_avg: weatherData.windSpeed / 1.151, //average wind speed during interval (knots)
    //wind_max:"", //maximum wind speed during interval (knots)
    //wind_min:"", //minimum wind speed during interval (knots)
    wind_direction: weatherData.windDirection, //wind direction as degrees (0 = north, 90 east etc...)
    temperature: weatherData.temperatureC, //temperature (celsius)
    rh: weatherData.humidity, //relative humidity (%)
    //mslp: "", //ressure reduced to sea level (hPa)
    //precip: "", //precipitation in milimeters (not displayed anywhere yet, but API is ready to accept)
    //precip_interval: "", //interval for the precip value in seconds (if not set then 3600 = 1 hour is assumed)
    salt: salt, //(required)	any random string, should change with every upload request (you can use current timestamp for example...)
    hash: hash, //(required)	MD5 hash of a string that consists of salt, uid and station password concatenated together (in this order, see example below)
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  fetch(`https://www.windguru.cz/upload/api.php?${params.toString()}`, {
    method: "GET",
    signal: controller.signal,
  })
    .then((response) => response.text())
    .then((data) => {
      clearTimeout(timeout);
      logger.log("http", "Sent request to windguru", data);
    })
    .catch((error) => {
      logger.log("error", "Error from windguru", error.message);
    });
};

module.exports = windguru;
