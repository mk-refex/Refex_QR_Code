require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { sequelize, Sequelize } = require("./src/models/index");
const history = require("connect-history-api-fallback");
const status = require("./src/helpers/Response");

const app = express();

// Middleware to parse incoming JSON data ==================================
app.use(express.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

app.use("/uploads", express.static(__dirname + "/uploads"));

// Configuration for CORS Origin ------------------------------------------------------
app.use(
  cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);
// app.use(cors("*"));       // To allow all orgins =============================

// // simple route
// app.get("/", (req, res) => {
//   return res.json({
//     success: true,
//     message: "Backend is running well",
//   });
// });

app.use("/auth", require("./src/routes/auth"));

app.use(
  "/api",
  require("./src/routes/assets"),
  require("./src/routes/integrations"),
  require("./src/routes/contest/contestForm"),
  require("./src/routes/brochure/brochure_download")
);

app.all("/api/*", (req, res) => {
  return status.ResponseStatus(res, 404, "Endpoint Not Found");
});

// Serve static files from the client build (preferred) or server/dist (fallback)
const clientDistPath = path.join(__dirname, "..", "client", "dist");
const serverDistPath = path.join(__dirname, "dist");
const distPath = fs.existsSync(clientDistPath) ? clientDistPath : serverDistPath;

app.use(express.static(distPath));
app.use(history());

// Serve the index.html for all routes
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// set port, listen for requests
const PORT = process.env.APP_PORT || 8080;

sequelize
  .sync()
  .then(async () => {
    console.log("Database synced successfully");

    // Ensure Asset schema is compatible (adds assets.qr_url if missing)
    try {
      const qi = sequelize.getQueryInterface();
      const table = await qi.describeTable("assets");
      if (!table.qr_url) {
        await qi.addColumn("assets", "qr_url", {
          type: Sequelize.DataTypes.STRING(512),
          allowNull: true,
        });
        console.log("Added assets.qr_url column");
      }
    } catch (e) {
      // If assets table doesn't exist yet or permissions missing, skip hard-fail
      console.warn("Asset schema check skipped:", e.message);
    }
    // Initialize cron jobs
    // reportService.generateAndSendDailyReport();
    // const setupCronJobs = require("./src/cron");
    // setupCronJobs();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}.`);
    });
  })
  .catch((err) => {
    console.error("Error syncing database:", err);
  });
