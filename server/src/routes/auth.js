const router = require("express").Router();
const authController = require('../controllers/auth');
const {createUserSchema, validateLogin} = require('../middlewares/userValidator');
const auth = require('../middlewares/auth');
const { SuperAdmin } = require("../utils/userRoles");

router.post("/login",validateLogin, authController.login);
router.post("/logout",auth.authCheck,authController.logout);
// router.post("/register",createUserSchema,authController.register);
// router.get("/verify_email/:token",authController.verifyMail);
// router.post("/forgot_password",authController.forgotPassword);
// router.patch("/reset_password/:token",authController.resetPassword);
// router.post("/verify_token/:token",authController.verifyToken);
// router.post("/create_api_key/:user_id",auth.authCheck,auth.authRole(SuperAdmin),authController.createAPIKeyForUser);

module.exports = router;