const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth'); 


dotenv.config();

const app = express();
app.use(express.json());  // To parse JSON requests

const PORT = process.env.PORT || 5000;

app.use('/api/auth', authRoutes);

app.use(cors()); 

app.get('/', (req, res) => {
    res.send('Welcome to the Sports Booking API!');
});
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
