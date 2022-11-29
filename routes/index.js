const authRoute = require("./auth");

// Auth routes
router.post("/signup", authRoute.signUp);
router.get("/signin", authRoute.signIn);
router.post("/generate_otp", authRoute.generateOTP);

module.exports = router;
