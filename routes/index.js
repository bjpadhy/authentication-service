const authRoute = require("./auth");

// Auth routes
router.post("/signup", authRoute.signUp);
router.get("/signin", authRoute.signIn);
router.post("/init_reset_password", authRoute.initiateResetPassword);
router.post("/init_update_password", authRoute.initiateUpdatePassword);

module.exports = router;
