const fs = require("fs");
const path = require("path");
const multer = require("multer");

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".heic", ".heif"]);

function billsDir() {
  const dir = path.join(__dirname, "..", "..", "uploads", "winter-campaign");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, billsDir());
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `bill-${unique}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    cb(new Error("Upload a clear bill as JPG, PNG, WEBP, HEIC, or PDF."));
    return;
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
});

function uploadBills(req, res, next) {
  upload.array("bills", MAX_FILES)(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    let message = err.message || "Unable to upload the bill.";
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "Each bill file must be 10 MB or smaller.";
    } else if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      message = "You can upload up to 5 bill files.";
    }
    res.status(400).json({
      status: false,
      status_code: 400,
      message,
    });
  });
}

module.exports = { uploadBills, MAX_FILES, MAX_FILE_SIZE };
