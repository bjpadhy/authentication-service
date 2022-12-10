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
  UPDATE_PASSWORD: {
    templateIDKey: "SENDGRID_RESET_PASSWORD_TEMPLATE",
    messageBody: "You will not be able to login with your old password until you set a new password.",
  },
});

/**
 * ENUM for storing supported actions for OTP generation
 * @enum
 */
export const SUPPORTED_OTP_TRIGGER_TYPES = Object.freeze(["UPDATE_PASSWORD"]);

/**
 * Query database to make a health check
 * @async
 * @function
 * @returns {Promise<Boolean>} Database health status
 */
export const checkDatabaseHealth = async () => {
  const result = await db.raw("SELECT 1");
  return Boolean(_.get(result, "rowCount", 0));
};

/**
 * Make a health check for send grid
 * @async
 * @function
 * @returns {Promise<Boolean>} Sendgrid API health status
 */
export const checkSendgridHealth = async () => {
  const result = await fetch("https://status.sendgrid.com/api/v2/summary.json");
  const { status } = _.find(_.get(await result.json(), "components"), { name: "Mail Sending" });

  return Boolean(status === "operational");
};

/**
 * Convert seconds to HH:MM:SS duration
 *
 * @function
 * @returns {String} Date ISO string
 */
export const secondsToDuration = (seconds) => {
  return new Date(seconds * 1000).toISOString().slice(11, 19);
};
