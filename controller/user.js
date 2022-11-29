import {
  BadRequestInputError,
  ResourceNotFoundError,
  UnauthorizedError,
  ResourceConflictError,
  InternalError,
} from "../lib/error";
import { isEmailValid, convertObjectKeysToSnakeCase, sendEmail } from "../lib/utils";
import { generateUserOTP, getUserByEmail, upsertUser, verifyUserPassword } from "../model/user";
import { nanoid } from "nanoid";
import * as jose from "jose";

/**
 * Executes email and password sign-up for a user
 * @async
 * @function
 * @param {Object} payloadData - signUp payload
 * @param {String} payloadData.email - user email
 * @param {String} payloadData.password - user password
 * @param {String} payloadData.firstName - user first name
 * @param {String} payloadData.lastName - user last name
 * @returns {Promise<Object>} Response object with JWT Token if signup was success
 *
 * @throws {ResourceConflictError} When user with email already exists
 * @throws {InternalError} When upsert user runs into an error
 */
export const signUpUser = async (payloadData) => {
  const { email, password, ...additionalData } = payloadData;
  // Validate required inputs
  const validatedPayloadData = _validateEmailPassword({ email, password });

  // Check is there is an existing user with same email
  const existingUser = await getUserByEmail(validatedPayloadData.email);
  if (!_.isEmpty(existingUser))
    throw new ResourceConflictError("User with same email already exists", { email: validatedPayloadData.email });

  // If it's a new user or deleted user, execute upsert
  const upsertData = convertObjectKeysToSnakeCase({ ...validatedPayloadData, ...additionalData });

  // Upsert user and get claims data; password hashing handled in PostgreSQL using pgcrypto
  const user = _.first(await upsertUser(upsertData));

  // If signUp was success, return the JWT
  if (user) return { token: await _generateJWT(user) };

  throw new InternalError("Error while creating user", validatedPayloadData);
};

/**
 * Validate email and password input
 *
 * @function
 * @param {Object} validationData - validation payload
 * @param {String} validationData.email - user email
 * @param {String} validationData.password - user password
 * @returns {Object} Validated data
 * @throws {BadRequestInputError} When email or password input is missing/email format is invalid
 */
const _validateEmailPassword = (validationData) => {
  const { email = "", password = "" } = validationData;

  // Validate input presence
  if ((email.length && password.length) === 0) throw new BadRequestInputError("Email or password missing", {});

  //  Validate email format
  if (!isEmailValid(email)) throw new BadRequestInputError("Email address format is invalid", { email });

  return { email: _.trim(email), password_hash: _.trim(password) };
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
  const { email, password_hash: password } = _validateEmailPassword(payloadData);

  // Verify password and fetch user
  const { assert_password, is_reset_password_initiated, ...user } = (await verifyUserPassword(email, password)) || {};
  if (_.isEmpty(user)) throw new ResourceNotFoundError("User not found", { email });

  // If password is correct, return the JWT
  if (assert_password && !is_reset_password_initiated) {
    return { token: await _generateJWT(user) };
  }

  // Throw 401 for incorrect password/reset initiated
  throw new UnauthorizedError(is_reset_password_initiated ? "Password reset initiated" : "Incorrect password", {
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
  const privateKey = new TextEncoder().encode(env.PRIVATE_KEY);
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setJti(nanoid())
    .setIssuedAt()
    .setIssuer(`auth-service:${process.pid}`)
    .setExpirationTime("4h")
    .sign(privateKey);
};

/**
 * Generates OTP and sends email to user
 * @async
 * @function
 * @param {Object} payloadData - OTP generation payload
 * @param {String} payloadData.email - user email
 * @param {String} payloadData.triggerAction - action for which the OTP is to be used
 * @returns {Promise<Object>} Promise object with isSuccess response boolean whether OTP generation and share was success
 *
 * @throws {BadRequestInputError} When user email is invalid
 * @throws {InternalError} When OTP generation/sharing fails
 */
export const generateAndShareUserOTP = async (payloadData) => {
  const { email = "", triggerAction = "" } = payloadData;

  // Validate email
  if (!isEmailValid(email) || !triggerAction.length) throw new BadRequestInputError("Invalid input data", { email });

  // Generate OTP
  const { OTP } = await generateUserOTP(email, triggerAction);
  if (!OTP) throw new InternalError("Error while generating OTP", { email });

  // Send email to user
  const response = await sendEmail({
    templateType: triggerAction,
    userEmail: email,
    OTP,
  });

  return { isSuccess: response };
};
