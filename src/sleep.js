/**
 * Function to trigger a sleep
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}
module.exports = sleep