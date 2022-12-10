import { checkDatabaseHealth, checkSendgridHealth, secondsToDuration } from "../lib/utils.js";

export const serviceHealthStatus = async (req) => {
  // Response time measure start
  const start = process.hrtime();
  const { httpVersion } = req;

  // Check database and send grid mail API health
  const [isDatabaseHealthy, isSendGridEmailAPIHealthy] = await Promise.all([
    checkDatabaseHealth(),
    checkSendgridHealth(),
  ]);

  let status;
  if (isDatabaseHealthy && isSendGridEmailAPIHealthy)
    status = { state: "OPERATIONAL", description: "All systems operational" };
  else if (isDatabaseHealthy || isSendGridEmailAPIHealthy) {
    status = { state: "DEGRADED" };
    status.description = isDatabaseHealthy ? "Mail API is currently having issues" : "Database service unavailable";
  } else status = { state: "OUTAGE", description: "Major systems outage" };

  // Response time measure end
  const end = process.hrtime(start);
  status.updated_at = new Date().toISOString();

  return {
    server: {
      httpVersion,
      pid: process.pid,
      uptime: secondsToDuration(process.uptime()),
      response_time: `${(end[0] * 1000 + end[1] / 1000000).toFixed(2)}ms`,
    },
    status,
  };
};
