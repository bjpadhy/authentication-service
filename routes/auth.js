import { errorHandler } from "../lib/error.js";
import { signInUser } from "../controller/user";

export const signIn = async (req, res) => {
  try {
    const result = await signInUser(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return errorHandler({ error }, res);
  }
};

module.exports = router;
