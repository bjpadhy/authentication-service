const authRoute = require("./auth");
const { servicesHealthCheck } = require("./healthCheck");

// Auth routes
router.post("/signup", authRoute.signUp);
router.get("/signin", authRoute.signIn);
router.post("/generate_otp", authRoute.generateOTP);
router.post("/update_password", authRoute.updatePassword);

// Health check
router.get("/health", servicesHealthCheck);

module.exports = router;
