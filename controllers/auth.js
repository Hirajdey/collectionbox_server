const User = require('../models/user');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const { registerEmailParams } = require('../helpers/email');
const shortId = require('shortid');

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




                                    