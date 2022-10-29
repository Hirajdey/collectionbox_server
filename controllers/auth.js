const User = require('../models/user');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const { expressjwt } = require('express-jwt'); 
const { registerEmailParams, forgotPasswordEmailParams } = require('../helpers/email');
const shortId = require('shortid');
const _ = require('lodash'); // lodash library extend method

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
})

const ses = new AWS.SES({apiVersion: '2010-12-01'});

exports.register = (req, res) => {    
    const { name, email, password } = req.body;

    // check if user exists in our DB
    User.findOne({email}).exec((err, user) => {
        if(user){
            console.log(err);
            return res.status(400).json({
                error: 'Email already exists'
            }) 
        }

        // generate token with user name email and password
        const token = jwt.sign({name, email, password}, process.env.JWT_ACCOUNT_ACTIVATION, {
            expiresIn:'10m'
        });

        // send email
        const params = registerEmailParams(email, token);
        
        const sendEmailOnRegister = ses.sendEmail(params).promise();
        
        sendEmailOnRegister.then(data => {
            console.log('Email submited to SES', data)
            res.json({
                message: `A verification email has been sent to ${email}, Please follow the instructinos to comjplete your registration process`
            })
        }).catch(error => {
            console.log('Ses email on register', error)
            res.json({
                error: `We could not verify your email. Please try again`
            })
        })

    });

};


exports.registerActivate = (req, res) => {  
    const { token } = req.body; 

    jwt.verify(token, process.env.JWT_ACCOUNT_ACTIVATION, function(err, decoded){
        if(err){
            return res.status(401).json({
                error: 'Expired link! Please Try again'
            })
        }
        
        const { name, email, password } = jwt.decode(token);
        const username = shortId.generate();
        
        User.findOne({email}).exec((err, user) => {
            if(user){
                return res.status(401).json({
                    error: 'Email already exists'
                })
            }

            // register new user
            const newUser = new User({username, name, email, password});
            newUser.save((err, result) => {
                if(err){
                    return res.status(401).json({
                        error: 'Registration process failed! Please try again'
                    });
                }
                return res.json({
                    message: 'User registration successfully done, Please login'
                });
            })
        })

    })
    
}

exports.login = (req, res) => {
    const { email, password } = req.body;
    
    User.findOne({email}).exec((err, user) => {
        if(err || !user){
            return res.status(400).json({
                error: "User with that email does not exist. Please register"
            })
        }

        // authenticate 
        if(!user.authenticate(password)){
            return res.status(400).json({
                error: "Email and password do not match "
            })
        }
        
        // generate token and send to client

        const token = jwt.sign({_id: user._id}, process.env.JWT_SECRET, {expiresIn: "1d"});
        const {_id, name, email, role} = user;         
        
        return res.json({
            token,
            user: {_id, name, email, role}   
        })

    });
}

exports.requireSignin = expressjwt({secret: process.env.JWT_SECRET, algorithms: ['HS256']}); // req.user

// place after requireSignin middleware in route
exports.authMiddleware = (req, res, next) => {
    const authUserId = req.auth._id; // this auth._id available from requireSignin middleware
   
    User.findOne({_id: authUserId}).exec((err, user) => {
        
        if(err || !user){
            return res.status(400).json({
                error: "User not found"
            })
        }

        req.profile = user;
        next()
    })
}

exports.adminMiddleware = (req, res, next) => {
    const adminUserId = req.auth._id; // this auth._id available from requireSignin middleware
    
    User.findOne({_id: adminUserId}).exec((err, user) => {
        
        if(err || !user){
            return res.status(400).json({
                error: "User not found"
            })
        }

        if(user.role !== 'admin'){
            return res.status(400).json({
                error: "Admin resource. Access denied"
            })
        }

        req.profile = user;
        next()
    })
}


exports.forgotPassword = (req, res) => {
    const { email } = req.body;
    // check if user exists with that email
    User.findOne({email}).exec((err, user) => {
        if(err || !user){
            return res.status(400).json({
                error: 'User with that email does not exist'
            })
        }

        // generate token and email to user 
        const token = jwt.sign({name: user.name}, process.env.JWT_RESET_PASSWORD, {expiresIn:'10m'});
        // send email
        const params = forgotPasswordEmailParams(email, token);
        
        // populate the db > user > resetPasswordLink
        return user.updateOne({resetPasswordLink: token}, (err, success) => {
            if(err){
                return res.status(400).json({
                    error: "Password reset failed. Try later"
                })
            }  
            
            const sendEmail = ses.sendEmail(params).promise();

            sendEmail.then(data => {
                console.log('ses reset pw success', data);
                return res.json({
                    message: `Email has been sent to ${email}. Click on the link to reset your password`
                })
            }).catch(error => {
                console.log('ses reset pw failed', error);
                return res.json({
                    message: 'We could not verify your email. Try later'
                })
            })

        });
        
    });
}

exports.resetPassword = (req, res) => {
    const { resetPasswordLink, newPassword } = req.body;

    if(resetPasswordLink){
         // check for expiry
        jwt.verify(resetPasswordLink, process.env.JWT_RESET_PASSWORD, (err, success) => {
            if(err){
                return res.status(400).json({
                    error: 'Expired Link. Try again'
                })
            }
    
            User.findOne({resetPasswordLink}).exec((err, user) => {
                if(err || !user){
                    return res.status(400).json({
                        error: 'Ivalid token. Try again'
                    })
                }

                const updatedFields = {
                    password: newPassword,
                    resetPasswordLink: ''
                }
                
                user = _.extend(user, updatedFields);

                user.save((err, result) => {
                    if(err){
                        return res.status(400).json({
                            error: 'Password reset failed. Try again'
                        })
                    }

                    res.json({
                        message: `Great! Now you can login with your new password`
                    });

                });
                
            });  
        });
    }
}


                                    