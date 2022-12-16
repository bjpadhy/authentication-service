import { errorHandler } from "../lib/error.js";
import { serviceHealthStatus } from "../controller/health.js";

export const servicesHealthCheck = async (req, res) => {
  const result = await serviceHealthStatus(req);
  try {
    return res.status(200).json(result);
  } catch (error) {
    return errorHandler({ error }, res);
  }
};
