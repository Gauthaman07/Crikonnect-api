const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const email = process.argv[2];

if (!email) {
    console.log('Please provide an email address as an argument.');
    console.log('Usage: node makeAdmin.js <email>');
    process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sportsBooking';

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        
        const user = await User.findOne({ email });
        
        if (!user) {
            console.log(`User with email ${email} not found.`);
            process.exit(1);
        }

        user.role = 'admin';
        await user.save();
        
        console.log(`Success! User ${user.name} (${email}) is now an ADMIN.`);
        console.log('You can now log in at http://localhost:5000/admin');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
