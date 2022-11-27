/**
 * Check if input string is a valid email ID
 * @function
 * @param {String} email - email input to validate
 * @returns {Boolean} Response boolean indicating email validity
 */
const isEmailValid = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Convert keys of input object to snake_case
 * @function
 * @param {Object} inputObject - input object
 * @returns {Object} Transformed object
 */
const convertObjectKeysToSnakeCase = (inputObject) => {
  return _.mapKeys(inputObject, (value, key) => _.snakeCase(key));
};

module.exports = {
  isEmailValid,
  convertObjectKeysToSnakeCase,
};
