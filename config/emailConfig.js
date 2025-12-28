require('dotenv').config();
const sgMail = require('@sendgrid/mail');

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Debugging
console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'Set (****...)' : 'Not Set');
console.log('EMAIL_USER:', process.env.EMAIL_USER);

// Verify configuration
if (process.env.SENDGRID_API_KEY) {
    console.log('✅ SendGrid is configured');
} else {
    console.log('❌ SendGrid API key not found');
}

module.exports = sgMail;
