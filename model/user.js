/**
 * /**
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
 * @returns {User} User object
 */
export const verifyUserPassword = (email, password) => {
  return db("auth.user AS u")
    .select(
      db.raw(
        `u.id, 
              u.email, 
              COALESCE(ut.user_type, 'PRIMARY') AS "userType", 
              COALESCE(ut.roles, '{admin}'::text[]) AS roles, 
              (u.password_hash = crypt(?, u.password_hash)) AS assert_password,
              u.is_reset_password_initiated`,
        password
      )
    )
    .leftJoin("auth.user_additional_info_map AS uaim", function () {
      this.on("uaim.fk_user_id", "u.id").on("uaim.is_deleted", db.raw("?", false));
    })
    .leftJoin("auth.user_type AS ut", function () {
      this.on("ut.id", "uaim.fk_user_type_id").on("ut.is_deleted", db.raw("?", false));
    })
    .where({ "u.email": email, "u.is_deleted": false })
    .first();
};
