const axios = require("axios");
const logger = require("../logger");
const cloudflare = (weatherData) => {
  if (!process.env.CLOUDFLARE_API_URL) return;

  axios({
    method: "get",
    url: process.env.CLOUDFLARE_API_URL,
    params: {
      weatherData,
    },
    timeout: 2000,
    responseType: "text",
  })
    .then(function (response) {
      logger.log("http", "Sent request to cloudflare", response.data);
    })
    .catch(function (error) {
      logger.log("error", "Error from cloudflare", error.data);
    });
};
module.exports = cloudflare;
