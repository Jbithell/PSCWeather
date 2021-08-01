
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, sleep));
}
module.exports = sleep