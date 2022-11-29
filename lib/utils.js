/**
 * Check if input string is a valid email ID
 * @function
 * @param {String} email - email input to validate
 * @returns {Boolean} Response boolean indicating email validity
 */
export const isEmailValid = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Convert keys of input object to snake_case
 * @function
 * @param {Object} inputObject - input object
 * @returns {Object} Transformed object
 */
export const convertObjectKeysToSnakeCase = (inputObject) => {
  return _.mapKeys(inputObject, (value, key) => _.snakeCase(key));
};

/**
 * Send email to a user using the sendgrid API
 * @async
 * @function
 * @param {Object} payload - email payload object
 * @param {String} payload.templateType - type of email to send
 * @param {String} payload.userEmail - emailID of user
 * @param {*} payload.emailPayload - Additional email data
 * @returns {Promise<boolean>} Promise boolean for indicating operation status
 */
export const sendEmail = async (payload) => {
  const { templateType, userEmail, ...emailPayload } = payload;

  // Get template data
  let { templateIDKey, messageBody } = SENDGRID_TEMPLATE_DATA_BY_TYPE[templateType];
  emailPayload.messageBody = messageBody;

  // Init sendgrid
  const client = require("@sendgrid/mail");
  client.setApiKey(env.SENDGRID_API_KEY);

  // Prep email data
  const message = {
    from: { email: env.SENDGRID_SENDER_EMAIL },
    template_id: _.get(env, templateIDKey),
    personalizations: [{ to: [{ email: userEmail }], dynamic_template_data: { ...emailPayload } }],
  };

  // Send email
  const response = _.first(await client.send(message));
  return response.statusCode === 202;
};

/**
 * ENUM for storing sendgrid template ID env key and messageBody for email
 * @enum
 */
const SENDGRID_TEMPLATE_DATA_BY_TYPE = Object.freeze({
  RESET_PASSWORD: {
    templateIDKey: "SENDGRID_RESET_PASSWORD_TEMPLATE",
    messageBody: "You will not be able to login with your old password until you reset the password.",
  },
  UPDATE_PASSWORD: {
    templateIDKey: "SENDGRID_UPDATE_PASSWORD_TEMPLATE",
    messageBody: "You can continue using your old password if no further action is taken.",
  },
});

/**
 * ENUM for storing supported actions for OTP generation
 * @enum
 */
export const SUPPORTED_OTP_TRIGGER_TYPES = Object.freeze(["RESET_PASSWORD", "UPDATE_PASSWORD"]);
