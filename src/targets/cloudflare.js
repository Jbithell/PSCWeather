const logger = require("../logger");

// Function to send weather data to Cloudflare
const cloudflare = (weatherData) => {
  if (!process.env.CLOUDFLARE_API_URL) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  fetch(process.env.CLOUDFLARE_API_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(weatherData),
    signal: controller.signal,
  })
    .then((response) => response.text())
    .then((data) => {
      clearTimeout(timeout);
      logger.log("http", "Sent request to cloudflare", data);
    })
    .catch((error) => {
      logger.log("error", "Error from cloudflare", error.message);
    });
};

module.exports = cloudflare;
