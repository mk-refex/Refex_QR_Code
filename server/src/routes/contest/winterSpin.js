const router = require("express").Router();
const winterSpinController = require("../../controllers/contest/winterSpin");

router.get("/winter-spin/status", winterSpinController.getStatus);
router.post("/winter-spin/issue", winterSpinController.issue);
router.post("/winter-spin/spin", winterSpinController.spin);

module.exports = router;
