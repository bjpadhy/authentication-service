import { BadRequestInputError, ResourceNotFoundError, UnauthorizedError } from "../lib/error";
import { verifyUserPassword } from "../model/user";
import { nanoid } from "nanoid";
import * as jose from "jose";

/**
 * Executes email and password sign-in for a user
 * @async
 * @function
 * @param {Object} payloadData - signIn payload
 * @param {String} payloadData.email - user email
 * @param {String} payloadData.password - user password
 * @returns {Promise<Object>} Response object with JWT Token
 * @throws {BadRequestInputError} When email or password input is missing
 * @throws {ResourceNotFoundError} When a user with matching email does not exist UnauthorizedError
 * @throws {UnauthorizedError} When the password is incorrect
 */
export const signInUser = async (payloadData) => {
  const { email = "", password = "" } = payloadData;

  // Validate input
  if ((email.length && password.length) === 0) throw new BadRequestInputError("Email or password missing", { email });

  // Verify password and fetch user
  const { assert_password, is_reset_password_initiated, ...user } = (await verifyUserPassword(email, password)) || {};
  if (_.isEmpty(user)) throw new ResourceNotFoundError("User not found", { email });

  // If password is correct, return the JWT
  if (assert_password && !is_reset_password_initiated) {
    const jwt = await _generateJWT(user);
    return { token: jwt };
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
