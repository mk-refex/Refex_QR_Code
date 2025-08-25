require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const cors = require("cors");
const { sequelize } = require("./src/models/index");
const history = require("connect-history-api-fallback");
const status = require("./src/helpers/Response");
const reportService = require("./src/services/reportService");

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
  require("./src/routes/contest/contestForm"),
  require("./src/routes/brochure/distribution_list"),
  require("./src/routes/brochure/brochure_download")
);

app.all("/api/*", (req, res) => {
  return status.ResponseStatus(res, 404, "Endpoint Not Found");
});

// Serve static files from the 'client/dist' directory
app.use(express.static(path.join(__dirname, "./dist")));
app.use(history());

// Serve the index.html for all routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "./dist", "index.html"));
});

// set port, listen for requests
const PORT = process.env.APP_PORT || 8080;

sequelize
  .sync({ alter: true })
  .then(() => {
    console.log("Database synced successfully");
    // Initialize cron jobs
    // reportService.generateAndSendDailyReport();
    const setupCronJobs = require("./src/cron");
    setupCronJobs();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}.`);
    });
  })
  .catch((err) => {
    console.error("Error syncing database:", err);
  });
