import {
  BadRequestInputError,
  ResourceNotFoundError,
  UnauthorizedError,
  ResourceConflictError,
  InternalError,
} from "../lib/error.js";
import { isEmailValid, convertObjectKeysToSnakeCase, sendEmail, SUPPORTED_OTP_TRIGGER_TYPES } from "../lib/utils.js";
import {
  generateUserOTP,
  getGenericRoleByType,
  getUserByEmail,
  upsertUser,
  upsertUserRoleMap,
  validateOTPAndUpdatePassword,
  verifyUserPassword,
} from "../model/user.js";
import { nanoid } from "nanoid";
import * as jose from "jose";

/**
 * Executes email and password sign-up for a user
 * @async
 * @function
 * @param {Object} payloadData - signUp payload
 * @param {String} payloadData.email - user email
 * @param {String} payloadData.password - user password
 * @param {String} payloadData.sourceId - user source id
 * @param {String} payloadData.role - user role
 * @param {String} [payloadData.firstName] - user first name
 * @param {String} [payloadData.lastName] - user last name
 * @returns {Promise<Object>} Response object with JWT Token if signup was success
 *
 * @throws {ResourceConflictError} When user with email already exists
 * @throws {InternalError} When upsert user runs into an error
 */
export const signUpUser = async (payloadData) => {
  const { email, password, sourceId, user_type, ...additionalData } = payloadData;
  // Validate required inputs
  const { roleData, ...validatedPayloadData } = await _validateRequiredInputFields(
    { email, password, sourceId, user_type },
    true
  );

  // Check is there is an existing user with same email
  const existingUser = await getUserByEmail(validatedPayloadData.email);
  if (!_.isEmpty(existingUser))
    throw new ResourceConflictError("User with same email already exists", { email: validatedPayloadData.email });

  // If it's a new user or deleted user, execute upsert
  const upsertData = convertObjectKeysToSnakeCase({ ...validatedPayloadData, ...additionalData });

  // Upsert user and get claims data; password hashing handled in PostgreSQL using pgcrypto
  const user = _.first(await upsertUser(upsertData));

  // If signUp was success, map user role and return the JWT
  if (user) {
    const { id: fk_role_id, type: user_type, role } = roleData;
    // Add user role mapping
    const userRole = await upsertUserRoleMap({ fk_user_id: user.id, fk_role_id });
    return { token: await _generateJWT({ ...user, user_type, role }) };
  }

  throw new InternalError("Error while creating user", validatedPayloadData);
};

/**
 * Validate email and password input
 *
 * @function
 * @param {Object} validationData - validation payload
 * @param {Boolean} [validateForSignup] - boolean whether or not to validate role
 * @param {String} validationData.email - user email
 * @param {String} validationData.password - user password
 * @param {String} [validationData.sourceId] - user source id
 * @returns {Object} Validated data
 * @throws {BadRequestInputError} When email or password input is missing/email format is invalid
 */
const _validateRequiredInputFields = async (validationData, validateForSignup = false) => {
  const { email = "", password = "", sourceId = "", user_type = "" } = validationData;

  // Validate input presence
  if ((validateForSignup ? email.length && password.length && sourceId.length : email.length && password.length) === 0)
    throw new BadRequestInputError("Required input missing", {});

  //  Validate email format
  if (!isEmailValid(email)) throw new BadRequestInputError("Email address format is invalid", { email });

  // Get generic role
  const roleData = await getGenericRoleByType(user_type);
  if (validateForSignup && !roleData) throw new BadRequestInputError("User type unsupported", { email });

  return {
    email: _.trim(email),
    password_hash: _.trim(password),
    source_id: _.trim(sourceId),
    roleData,
  };
};

/**
 * Executes email and password sign-in for a user
 * @async
 * @function
 * @param {Object} payloadData - signIn payload
 * @param {String} payloadData.email - user email
 * @param {String} payloadData.password - user password
 * @returns {Promise<Object>} Response object with JWT Token
 *
 * @throws {ResourceNotFoundError} When a user with matching email does not exist UnauthorizedError
 * @throws {UnauthorizedError} When the password is incorrect
 */
export const signInUser = async (payloadData) => {
  // Validate input
  const { email, password_hash: password } = await _validateRequiredInputFields(payloadData);

  // Verify password and fetch user
  const { assert_password, is_password_update_initiated, ...user } = (await verifyUserPassword(email, password)) || {};
  if (_.isEmpty(user)) throw new ResourceNotFoundError("User not found", { email });

  // If password is correct, return the JWT
  if (assert_password && !is_password_update_initiated) {
    return { token: await _generateJWT(user) };
  }

  // Throw 401 for incorrect password/reset initiated
  throw new UnauthorizedError(is_password_update_initiated ? "Password update initiated" : "Incorrect password", {
    email,
  });
};

/**
 * Generates HS256 protected JWT token
 * @private
 * @function
 * @param {Object} payload - user object
 *
 * @returns {Promise<String>} JWT Token
 */
const _generateJWT = (payload) => {
  const { id, email, source_id, user_type, role } = payload;
  const privateKey = new TextEncoder().encode(env.PRIVATE_KEY);
  return new jose.SignJWT({ id, email, user_type, role })
    .setAudience(source_id)
    .setProtectedHeader({ alg: "HS256" })
    .setJti(nanoid())
    .setIssuedAt()
    .setIssuer(`auth-service`)
    .setExpirationTime("4h")
    .sign(privateKey);
};

/**
 * Generates OTP and sends email to user
 * @async
 * @function
 * @param {Object} payloadData - OTP generation payload
 * @param {String} payloadData.email - user email
 * @param {String} payloadData.type - action for which the OTP is to be used
 * @returns {Promise<Object>} Promise object with isSuccess response boolean whether OTP generation and share was success
 *
 * @throws {BadRequestInputError} When user email is invalid
 * @throws {InternalError} When OTP generation/sharing fails
 */
export const generateAndShareUserOTP = async (payloadData) => {
  const { email = "", type = "" } = payloadData;

  // Validate email
  if (!isEmailValid(email)) throw new BadRequestInputError("Email address format is invalid", { email });
  if (!SUPPORTED_OTP_TRIGGER_TYPES.includes(type))
    throw new BadRequestInputError("Unsupported type for OTP generation", { email });

  // Generate OTP
  const { OTP } = await generateUserOTP(email, type);
  if (!OTP) throw new InternalError("Error while generating OTP", { email });

  // Send email to user
  const response = await sendEmail({
    templateType: type,
    userEmail: email,
    OTP,
  });

  return { isSuccess: response };
};

/**
 * Updates user password
 * @async
 * @function
 * @param {Object} payloadData - OTP generation payload
 * @param {String} payloadData.email - user email
 * @param {Number} payloadData.otp - otp generated for password update or reset
 * @param {String} payloadData.newPassword - new updated password
 *
 * @returns {Promise<Object>} Promise object with isSuccess response boolean whether password reset was success
 *
 * @throws {BadRequestInputError} When user email or otp is invalid
 * @throws {InternalError} When password reset fails
 */
export const updatePasswordByOTP = async (payloadData) => {
  const { email, otp, newPassword } = payloadData;
  const isInputEmpty = _.some({ email, otp, newPassword }, _.isNil);

  if (isInputEmpty || !isEmailValid(email)) throw new BadRequestInputError("Invalid input", { email });

  try {
    const { isSuccess } = await validateOTPAndUpdatePassword(email, otp, newPassword);
    return { isSuccess };
  } catch (error) {
    // Catch exceptions thrown by db function
    throw new BadRequestInputError(_.get(error, "hint", ""), { email });
  }
};
