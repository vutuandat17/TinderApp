const express = require("express");
const fs = require("fs");
const path = require("path");
const routes = require("./routes");

const app = express();

// Load Swagger UI only in development
if (process.env.NODE_ENV !== "production") {
  try {
    const swaggerUi = require("swagger-ui-express");
    const swaggerDocumentPath = path.join(__dirname, "../docs/openapi.yaml");
    const yaml = require("js-yaml");

    const swaggerDoc = fs.readFileSync(swaggerDocumentPath, "utf8");
    const swaggerDocument = yaml.load(swaggerDoc);

    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log("Swagger UI available at /api-docs");
  } catch (error) {
    console.warn("Warning: Failed to load Swagger UI:", error.message);
  }
}

app.use((req, res, next) => {
  const allowedOrigin = process.env.CLIENT_ORIGIN || "*";
  res.header("Access-Control-Allow-Origin", allowedOrigin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS",
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "tinder-clone-api",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", routes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  const payload = {
    message: error.message || "Internal server error",
  };

  if (process.env.NODE_ENV !== "production" && error.details) {
    payload.details = error.details;
  }

  res.status(status).json(payload);
});

module.exports = app;
