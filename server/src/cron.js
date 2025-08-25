const cron = require("node-cron");
const reportService = require("./services/reportService");

// Schedule the job to run daily at 10 AM
const setupCronJobs = () => {
  cron.schedule(
    "0 10 * * *",
    async () => {
      console.log("Running daily contest form report job...");
      try {
        await reportService.generateAndSendDailyReport();
      } catch (error) {
        console.error("Error in daily contest form report job:", error);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata", // Adjust to your timezone
    }
  );

  console.log("Cron jobs scheduled");
};

module.exports = setupCronJobs;
