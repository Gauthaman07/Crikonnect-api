// routes/auth.js

const express = require('express');
const { signup, login, forgotPassword, verifyOTP, resetPassword } = require('../controllers/userController');
const authenticateUser = require('../middleware/authenticateUser');
const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);

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
