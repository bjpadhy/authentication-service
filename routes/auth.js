import { errorHandler } from "../lib/error.js";
import { updatePasswordByOTP, generateAndShareUserOTP, signInUser, signUpUser } from "../controller/user.js";

export const signIn = async (req, res) => {
  try {
    const result = await signInUser(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return errorHandler({ error }, res);
  }
};

export const signUp = async (req, res) => {
  try {
    const result = await signUpUser(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return errorHandler({ error }, res);
  }
};

export const generateOTP = async (req, res) => {
  try {
    const result = await generateAndShareUserOTP(req.body);
    return res.status(202).json(result);
  } catch (error) {
    return errorHandler({ error }, res);
  }
};

export const updatePassword = async (req, res) => {
  try {
    const result = await updatePasswordByOTP(req.body);
    return res.status(202).json(result);
  } catch (error) {
    return errorHandler({ error }, res);
  }
};
