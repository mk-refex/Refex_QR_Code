const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

const {User,LoginHistory} = require("../models");
const status = require('../helpers/Response');
const sendMail = require("../helpers/sendMail");
const ecryption = require("../helpers/encryption");
const Role = require("../utils/userRoles");

const { APP_KEY} = process.env;

module.exports = {
    login: async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return status.ResponseStatus(res, 400, "Validation Failed", errors);
          }
          const { email, password } = req.body;
          const existingUser = await User.findOne({where:{email}});
          if (existingUser) {
            if (!Boolean(existingUser.is_verified)) {
              return status.ResponseStatus(res, 401, "Email not verified");
            }
            const compare = await bcrypt.compare(
              password,
              existingUser.password
            );
            if (compare) {
              const { id, first_name, last_name, email, user_name,role, photo} = existingUser;
              const history = await LoginHistory.create({ user_id:id, first_name, last_name, email, user_name, status:'Logged-In'});
              const token = jwt.sign({ session_id:history.id,user_id:id }, APP_KEY, { expiresIn: '1d' });   //, { expiresIn: '1d' }
              return res.status(200).json({
                status: true,
                message: "Login successfully",
                session_id: history.id,
                token,
                user_data:{
                  id,
                  first_name,
                  last_name,
                  email,
                  user_name,
                  role,
                  photo: photo ? Buffer.from(photo, "binary").toString() : null,
                }
              });
            } else {
              return status.ResponseStatus(res, 401, "Invalid password");
            }
          } else {
            return status.ResponseStatus(res, 401, "Invalid email");
          }
        } catch (error) {
          console.log(error.message);
          return status.ResponseStatus(res, 500, "Internal server error", {
            error: error.message,
          });
        }
    },
    logout:async (req, res) => {
        try{
          const {session_id} = req.session_data;
          const result = await LoginHistory.update({status:"Logged-Out"},{where:{id:session_id}});
          if(result){
            return status.ResponseStatus(res,200,"Logout successfully");
          }else{
            return status.ResponseStatus(res,401,"Logout unsuccessful");
          }
        }catch(error){
        return status.ResponseStatus(res, 500, "Internal server error",error);
        }
    }
}