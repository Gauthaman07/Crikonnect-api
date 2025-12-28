const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateUser = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Authentication token required' });
    }

    try {
        // Step 1: Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Step 2: Check if user actually exists in database
        const user = await User.findById(decoded.id);

        if (!user) {
            console.log(`Auth failed: User ${decoded.id} not found in database (token is valid but user deleted)`);
            return res.status(401).json({
                message: 'User account not found. Please log in again.',
                reason: 'user_not_found'
            });
        }

        // Step 3: Set user info and continue
        req.user = {
            id: user._id,
            email: user.email,
            role: user.role
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            console.log('Invalid token:', error.message);
            return res.status(401).json({ message: 'Invalid authentication token' });
        }
        if (error.name === 'TokenExpiredError') {
            console.log('Expired token:', error.message);
            return res.status(401).json({ message: 'Authentication token has expired' });
        }
        console.log('Token verification error:', error);
        res.status(401).json({ message: 'You are not logged in. Please log in to continue.' });
    }
};


module.exports = authenticateUser;