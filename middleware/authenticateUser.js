const jwt = require('jsonwebtoken');

const authenticateUser = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Authentication token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            id: decoded.id  // Make sure this matches what you set in the login/signup
        };
        next();
    } catch (error) {
        console.log('Token verification error:', error);
        res.status(401).json({ message: 'You are not logged in. Please log in to continue.' });
    }
};


module.exports = authenticateUser;