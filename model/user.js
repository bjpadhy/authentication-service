/**
 *
 * @typedef User
 * @type {Object}
 * @property {String} id - user UUIDv4
 * @property {String} email - user email
 * @property {String} userType - user type
 * @property {Array<String>} roles - user type roles
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
              COALESCE(gut.user_type, 'PRIMARY') AS "userType", 
              COALESCE(gut.roles, '{admin}'::text[]) AS roles, 
              (u.password_hash = crypt(?, u.password_hash)) AS assert_password,
              u.is_reset_password_initiated`,
        password
      )
    )
    .leftJoin("auth.user_info AS ui", function () {
      this.on("ui.fk_user_id", "u.id").on("ui.is_deleted", db.raw("?", false));
    })
    .leftJoin("auth.generic_user_type AS gut", function () {
      this.on("gut.id", "ui.fk_user_type_id").on("gut.is_deleted", db.raw("?", false));
    })
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
 *
 * @returns {Promise<User>} Promise object of type User
 */
export const upsertUser = (payloadData) => {
  return db
    .with("in_data", function () {
      this.insert(payloadData)
        .into("auth.user")
        .returning("*")
        .onConflict("email")
        .merge({ ..._.omit(payloadData, ["email", "password_hash"]), updated_at: db.fn.now(), is_deleted: false });
    })
    .select(
      db.raw(
        `in_data.id, in_data.email, COALESCE(gut.user_type, 'PRIMARY') AS "userType", COALESCE(gut.roles, '{admin}'::text[]) AS roles`
      )
    )
    .from("in_data")
    .leftJoin("auth.user_info AS ui", function () {
      this.on("ui.fk_user_id", "in_data.id").on("ui.is_deleted", db.raw("?", false));
    })
    .leftJoin("auth.generic_user_type AS gut", function () {
      this.on("gut.id", "ui.fk_user_type_id").on("gut.is_deleted", db.raw("?", false));
    });
};

/**
 * Initiate password reset and generate OTP
 *
 * @function
 * @param {String} email - user email
 *
 * @returns {Promise<Number>} Promise integer OTP
 */
export const generateResetPasswordOTP = (email) => {
  return db.select("*").from(db.raw("auth.initiate_reset_password(?)", email)).first();
};
