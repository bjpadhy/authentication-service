const authRoute = require("./auth");

// Auth routes
router.post("/signup", authRoute.signUp);
router.post("/init_reset_password", authRoute.initiateResetPassword);
router.get("/signin", authRoute.signIn);
// router.post("/reset_password", authRoute.resetPassword);

module.exports = router;
