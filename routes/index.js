const authRoute = require("./auth");

// Auth routes
// router.post("/signup", authRoute.signup);
// router.post("/request-otp", authRoute.requestOTP);
router.get("/signin", authRoute.signIn);
// router.post("/resetpassword", authRoute.resetPassword);

module.exports = router;
