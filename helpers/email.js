exports.registerEmailParams = (email, token) => {
    const params = {
        Source: process.env.EMAIL_FROM,
        Destination: {
            ToAddresses: [email]
        },
        ReplyToAddresses: [process.env.EMAIL_TO],
        Message:{
            Body: {
                Html:{
                    Charset: "UTF-8",
                    Data: `
                        <html> 
                            <h1> Verify your email address</h1> 
                            <p>Please use the following link to complete your registration:</p>
                            <p>${process.env.CLIENT_URL}/auth/activate/${token}</p>
                        </html>`
                }
            },
            Subject: {
                Charset: 'UTF-8',
                Data: "Complete your registration"
            }
        }
    };

    return params
}


exports.forgotPasswordEmailParams = (email, token) => {
    const params = {
        Source: process.env.EMAIL_FROM,
        Destination: {
            ToAddresses: [email]
        },
        ReplyToAddresses: [process.env.EMAIL_TO],
        Message:{
            Body: {
                Html:{
                    Charset: "UTF-8",
                    Data: `
                        <html> 
                            <h1>Reset Password Link</h1> 
                            <p>Please use the following link to reset your password:</p>
                            <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
                        </html>`
                }
            },
            Subject: {
                Charset: 'UTF-8',
                Data: "Reset your password"
            }
        }
    };

    return params
}