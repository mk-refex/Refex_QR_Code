const router = require("express").Router();
const multer = require("multer");

const auth = require("../middlewares/auth");
const assetsController = require("../controllers/assets");

const upload = multer({ storage: multer.memoryStorage() });

// Public (no-auth) read for asset detail page
router.get("/assets_public/:asset_id", assetsController.publicGetById);

router.get("/assets", auth.authCheck, assetsController.list);
router.get("/assets/export", auth.authCheck, assetsController.exportCsv);
router.get("/assets/:asset_id", auth.authCheck, assetsController.getById);

router.post("/assets", auth.authCheck, assetsController.create);
router.put("/assets/:asset_id", auth.authCheck, assetsController.update);
router.delete("/assets/:asset_id", auth.authCheck, assetsController.remove);

router.post(
  "/assets/import",
  auth.authCheck,
  upload.single("file"),
  assetsController.importCsvOrJson
);

module.exports = router;

