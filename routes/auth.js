import { errorHandler } from "../lib/error.js";
import { signInUser, signUpUser } from "../controller/user";

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

module.exports = router;
