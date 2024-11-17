const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teamRoutes');


dotenv.config();

const app = express();
app.use(express.json());  // To parse JSON requests
app.use(cors());  // Allow cross-origin requests

const PORT = process.env.PORT || 5000;

app.use('/api/auth', authRoutes);
app.use('/api/team', teamRoutes);

app.get('/', (req, res) => {
    res.send('Welcome to the Sports Booking API!');
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const corsOptions = {
    origin: '*',  // Or the domain where your frontend is running
    methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'],  // Allow headers like Authorization
};

app.use(cors(corsOptions));  // Apply the custom CORS configuration
