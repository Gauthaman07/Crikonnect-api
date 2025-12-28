// routes/auth.js

const express = require('express');
const { signup, login, forgotPassword, verifyOTP, resetPassword } = require('../controllers/userController');
const authenticateUser = require('../middleware/authenticateUser');
const router = express.Router();

// Wrap async route handlers to catch errors
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
        console.error('Route error:', err);
        res.status(500).json({
            success: false,
            message: err.message || 'Internal server error'
        });
    });
};

router.post('/signup', asyncHandler(signup));
router.post('/login', asyncHandler(login));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/verify-otp', asyncHandler(verifyOTP));
router.post('/reset-password', asyncHandler(resetPassword));

// Validate session endpoint - checks if token is valid and user exists
router.get('/validate-session', authenticateUser, (req, res) => {
    // If middleware passes, token is valid and user exists
    res.status(200).json({
        valid: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role
        }
    });
});

module.exports = router;
