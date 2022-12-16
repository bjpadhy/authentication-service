import express from "express";

// Utility imports
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import * as lodash from "lodash-es";

// Data source import
import knex from "knex";

// Route handler
import { routeHandler } from "./routes/index.js";

// Globals
global.env = process.env;
global._ = lodash;
global.router = express.Router();
const app = express();

// Start the server
app.listen(env.PORT, async () => {
  // Connect postgres
  global.db = knex({
    client: "pg",
    connection: env.DB_URL,
  });

  // Ready
  if (env.DEPLOY_ENV !== "production") console.log(`Listening on ${env.PORT}`);
});

// Middlewares
app.use(morgan(":method :url\nSTATUS: :status RESPONSE-TIME: :response-time ms"));
app.use(compression());
app.use(helmet());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Source route
app.use("/", routeHandler);

// Handle wildcard
app.use("*", (req, res) => {
  res.status(404);
  res.json({
    errorCode: 404,
    errorMessage: "Unable to find requested resource",
  });
});
