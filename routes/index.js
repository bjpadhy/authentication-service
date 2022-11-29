const authRoute = require("./auth");

// Auth routes
router.post("/signup", authRoute.signUp);
router.post("/reset_password", authRoute.initiateResetPassword);
router.get("/signin", authRoute.signIn);

module.exports = router;
