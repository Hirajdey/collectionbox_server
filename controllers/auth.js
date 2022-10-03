const User = require('../models/user');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const { registerEmailParams } = require('../helpers/email');

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




                                    