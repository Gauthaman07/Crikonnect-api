const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const helmet = require('helmet');
const authRoutes = require('./routes/auth');
const userProfileRoutes = require('./routes/userprofile');
const teamRoutes = require('./routes/teamRoutes');
const cloudinary = require('cloudinary').v2;
const groundRoutes = require('./routes/groundRoutes');
const groundBookingRoutes = require('./routes/groundBookingRoutes');
const tournamentRoutes = require('./routes/tournamentRoutes');


dotenv.config();

const app = express();

// Ensure the 'uploads' folder exists
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// CORS Configuration
const corsOptions = {
    origin: '*', // Or specify your frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions)); // Apply CORS configuration

// Set up multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads'); // Destination folder for uploaded files
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname); // File name will be the timestamp + original name
    },
});
const upload = multer({ storage: storage });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet()); // Add security headers

// Serve uploaded files from the 'uploads' folder
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userProfileRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/grounds', groundRoutes);
app.use('/api/ground-booking', groundBookingRoutes);
// Test route
app.get('/', (req, res) => {
    res.send('Welcome to the Sports Booking API!');
});
app.use('/api/tournaments', tournamentRoutes);
// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sportsBooking';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('Failed to connect to MongoDB:', err.message);
        process.exit(1); // Exit process if DB connection fails
    });


// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


process.on('SIGTERM', () => {
    console.log('SIGTERM received: Closing server gracefully...');
    // Add any cleanup logic here (e.g., close DB connections)
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received: Shutting down...');
    process.exit(0);
});
