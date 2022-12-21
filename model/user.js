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
              u.first_name || ' ' || u.last_name as name,
              u.source_id,
              r.role,
              r.type as user_type,
              (u.password_hash = crypt(?, u.password_hash)) AS assert_password,
              u.is_password_update_initiated`,
        password
      )
    )
    .innerJoin("auth.user_role_map AS urm", "urm.fk_user_id", "u.id")
    .innerJoin("auth.generic_roles AS r", "urm.fk_role_id", "r.id")
    .where({ "u.email": email, "u.is_deleted": false, "urm.is_deleted": false, "r.is_deleted": false })
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
  return db("auth.user AS u").select("u.*").where({ email, "u.is_deleted": false });
};

/**
 *
 * Get generic role
 *
 * @function
 * @param {String} type - user role
 *
 * @returns {Promise<User>} Promise object with generic role
 */
export const getGenericRoleByType = (type) => {
  return db("auth.generic_roles AS r").select("r.*").where({ type, "r.is_deleted": false }).first();
};

/**
 *
 * Upserts user data
 *
 * @function
 * @param {Object} payloadData - user data
 * @param {String} payloadData.email - user email
 * @param {String} payloadData.password - user password
 * @param {String} [payloadData.first_name] - user first name
 * @param {String} [payloadData.last_name] - user last name
 * @param {String} payloadData.source_id - user source id
 *
 * @returns {Promise<User>} Promise object of type User
 */
export const upsertUser = (payloadData) => {
  return db
    .insert(payloadData)
    .into("auth.user")
    .onConflict("email")
    .merge({
      ..._.omit(payloadData, ["email", "password_hash"]),
      deleted_at: null,
      updated_at: db.fn.now(),
      is_deleted: false,
    })
    .returning("*");
};

/**
 *
 * Upserts user role mapping data
 *
 * @function
 * @param {Object} payloadData - user role data
 * @param {String} payloadData.fk_user_id - userID
 * @param {String} payloadData.fk_role_id - generic roleID
 *
 * @returns {Promise<User>} Promise object of user role
 */
export const upsertUserRoleMap = (payloadData) => {
  return db
    .insert(payloadData)
    .into("auth.user_role_map")
    .onConflict("fk_user_id")
    .merge({
      ..._.omit(payloadData, "fk_user_id"),
      updated_at: db.fn.now(),
      is_deleted: false,
    })
    .returning("*");
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

/**
 * Validate OTP generated for password update and change the password
 *
 * @function
 * @param {String} email - user email
 * @param {Number} otp - password update OTP
 * @param {String} newPassword - new password to set
 *
 * @returns {Promise<Boolean>} Promise boolean for operation success
 */
export const validateOTPAndUpdatePassword = (email, otp, newPassword) => {
  return db
    .select(`update_password AS isSuccess`)
    .from(db.raw("auth.update_password(?, ?, ?)", [email, otp, newPassword]))
    .first();
};
