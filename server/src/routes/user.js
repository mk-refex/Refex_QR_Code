const router = require("express").Router();
const userController = require("../controllers/user");
const auth = require("../middlewares/auth");

router
  .route("/users/:user_id")
  .get(auth.authCheck,userController.getUserById);

module.exports = router