const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,     // Your Gmail address
        pass: process.env.EMAIL_PASSWORD  // Your Gmail app password
    }
});

module.exports = transporter;