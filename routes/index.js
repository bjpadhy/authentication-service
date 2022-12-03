const authRoute = require("./auth");

// Auth routes
router.post("/signup", authRoute.signUp);
router.get("/signin", authRoute.signIn);
router.post("/generate_otp", authRoute.generateOTP);
router.post("/update_password", authRoute.updatePassword);

module.exports = router;
