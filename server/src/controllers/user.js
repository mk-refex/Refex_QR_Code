const {User} = require("../models");
const status = require('../helpers/Response');
// const Role = require('../utils/userRoles');
const {DEFAULT_PASSWORD} = process.env;
const { validationResult } = require('express-validator');
const saltRounds = 10;

module.exports = {
    createUser: async (req, res)=>{
        try {
          const result =  await User.create({first_name:"Hello",last_name:"World",email:"kumarmurugesh@gmail.com"});
          console.log(result)
          const getRes = await User.
          status.ResponseStatus(res,200,"Success");
        } catch (error) {
            console.log(error);
            status.ResponseStatus(res,500,error);
        }
    },
    getUserById: async (req, res)=>{
        try {
            const {user_id}=req.params;
            const user= await User.findByPk(user_id);
            if(user){
                return status.ResponseStatus(res, 200, `Details of user (${user.email})`, user);
            }
            return status.ResponseStatus(res, 404, "User not found");
        } catch (error) {
            console.log(error);
            return status.ResponseStatus(res, 500, "Internal server error",error);
        }
    }
}