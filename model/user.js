/**
 *
 * @typedef User
 * @type {Object}
 * @property {String} id - user UUIDv4
 * @property {String} email - user email
 * @property {String} source_id - user type
 * @property {Boolean} assert_password - password assertion result
 *
 * Gets non deleted user along with password assertion by email
 *
 * @function
 * @param {String} email - user email
 * @param {String} password - user password
 *
 * @returns {Promise<User>} Promise object of type User
 */
export const verifyUserPassword = (email, password) => {
  return db("auth.user AS u")
    .select(
      db.raw(
        `u.id, 
              u.email,
              u.source_id,
              (u.password_hash = crypt(?, u.password_hash)) AS assert_password,
              u.is_reset_password_initiated`,
        password
      )
    )
    .where({ "u.email": email, "u.is_deleted": false })
    .first();
};

/**
 *
 * Gets non deleted user by email
 *
 * @function
 * @param {String} email - user email
 *
 * @returns {Promise<User>} Promise object of type User
 */
export const getUserByEmail = (email) => {
  return db("auth.user").select("*").where({ email, is_deleted: false });
};

/**
 *
 * Gets non deleted users by ids
 *
 * @function
 * @param {Array<String>} userIds - user id
 *
 * @returns {Promise<User>} Promise object of type User
 */
export const getUsersByIds = (userIds) => {
  return db("auth.user AS u").select("u.*").whereIn("u.id", userIds).where("u.is_deleted", false);
};

/**
 *
 * Upserts user data
 *
 * @function
 * @param {Object} payloadData - user data
 * @param {String} payloadData.email - user email
 * @param {String} payloadData.password - user password
 * @param {String} payloadData.first_name - user first name
 * @param {String} payloadData.last_name - user last name
 * @param {String} payloadData.source_id - user source service
 *
 * @returns {Promise<User>} Promise object of type User
 */
export const upsertUser = (payloadData) => {
  return db
    .insert(payloadData)
    .into("auth.user")
    .returning("*")
    .onConflict("email")
    .merge({ ..._.omit(payloadData, ["email", "password_hash"]), updated_at: db.fn.now(), is_deleted: false });
};

/**
 * Initiate password reset and generate OTP
 *
 * @function
 * @param {String} email - user email
 * @param {String} triggerType - action for which OTP is to be used
 *
 * @returns {Promise<Number>} Promise integer OTP
 */
export const generateUserOTP = (email, triggerType) => {
  return db
    .select(`generate_otp AS OTP`)
    .from(db.raw("auth.generate_otp(?, ?)", [email, triggerType]))
    .first();
};
