const logger = require("./logger");
/**
 * Script to validate a buffer is of the format "loop"
 * @param {Buffer} inputBuffer
 */
const validator = (inputBuffer) => {
  let offset = false;
  const inputBufferLength = inputBuffer.length;
  if (inputBufferLength < 40) {
    logger.log(
      "debug",
      `Buffer received too short - length is ${inputBufferLength}`,
      inputBuffer
    );
    return false;
  }
  for (let thisOffset = 0; thisOffset < inputBufferLength - 3; thisOffset++) {
    if (
      inputBuffer.slice(thisOffset, thisOffset + 3).toString("utf8") === "LOO"
    ) {
      offset = thisOffset;
      break;
    }
  }
  if (!offset) {
    logger.log(
      "debug",
      "Buffer received doesn't contain LOO (76,79,79)",
      inputBuffer
    );
    return false;
  }
  if (inputBufferLength - offset < 60) {
    logger.log(
      "debug",
      `Buffer received too short - length is ${inputBufferLength} and offset is ${offset} so there is not 60 after the offset`,
      inputBuffer
    );
    return false;
  }

  logger.log("debug", `This offset is ${offset}`);
  return offset;
};
module.exports = validator;
