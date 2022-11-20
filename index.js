const express = require("express");
require = require("esm")(module);

// Middleware imports
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");

// Data source imports

// Globals
global.env = process.env;
global._ = require("lodash");
global.router = express.Router();
global.app = express();

// Start the server
app.listen(env.PORT, async () => {
  // Connect postgres
  global.db = require("knex")({
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
app.use("/", require("./routes/index.js"));

// Handle wildcard
app.use("*", (req, res) => {
  res.status(404);
  res.json({
    errorCode: 404,
    errorMessage: "Unable to find requested resource",
  });
});
