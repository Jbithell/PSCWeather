const logger = require("../logger");

// Function to send a heartbeat to Cloudflare to show the device is still alive
const cloudflareHeartbeat = () => {
  const url = process.env.CLOUDFLARE_HEARTBEAT_URL;
  if (!url) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  fetch(url, { method: "HEAD", signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      logger.verbose("http", "Sent heartbeat to cloudflare");
    })
    .catch((error) => {
      logger.log(
        "error",
        "Error from cloudflare when sending heartbeat",
        error.message
      );
    })
    .finally(() => clearTimeout(timeout));
};

module.exports = cloudflareHeartbeat;
