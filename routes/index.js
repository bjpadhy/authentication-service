import { signUp, signIn, generateOTP, updatePassword } from "./auth.js";
import { servicesHealthCheck } from "./healthCheck.js";
import express from "express";
const router = express.Router();

// Auth routes
router.post("/signup", signUp);
router.get("/signin", signIn);
router.post("/generate_otp", generateOTP);
router.post("/update_password", updatePassword);

// Health check
router.get("/health", servicesHealthCheck);

export { router as routeHandler };
