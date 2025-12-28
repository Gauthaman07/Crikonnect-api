const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Team = require('../models/team');    // Add this line
const Ground = require('../models/ground');
const transporter = require('../config/emailConfig');

// Signup logic (already implemented)
exports.signup = async (req, res) => {
    const { name, mobile, email, password } = req.body;

    // if (password !== confirmPassword) {
    //     return res.status(400).json({ message: "Passwords don't match" });
    // }

    try {
        const mobileExists = await User.findOne({ mobile });
        if (mobileExists) {
            return res.status(400).json({ message: "Mobile number already registered" });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name,
            mobile,
            email,
            password: hashedPassword
        });

        await user.save();
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ message: 'User created successfully', token, user });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// Login logic
exports.login = async (req, res) => {
    const { emailOrMobile, password } = req.body;

    try {
        // Find the user by email or mobile number
        console.log("Input:", emailOrMobile);
        const user = await User.findOne({
            $or: [{ email: emailOrMobile }, { mobile: emailOrMobile }],
        });
        console.log("User found:", user);


        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Compare the password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Generate a JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(200).json({
            token,
            user: {  id: user._id, email: user.email, mobile: user.mobile }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// ... your existing signup and login code ...

// Add this new profile endpoint
exports.getProfile = async (req, res) => {
    try {
        // Get user details (excluding password)
        const user = await User.findById(req.user.id)
            .select('-password');

        // Find team where user is either creator or member
        const team = await Team.findOne({
            $or: [
                { createdBy: req.user.id },
                { members: req.user.id }
            ]
        }).populate('groundId');

        // Structure the response
        const profileData = {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                createdAt: user.createdAt
            },
            team: team ? {
                id: team._id,
                teamName: team.teamName,
                teamLogo: team.teamLogo,
                location: team.location,
                hasOwnGround: team.hasOwnGround,
                ground: team.groundId ? {
                    id: team.groundId._id,
                    groundName: team.groundId.groundName,
                    description: team.groundId.description,
                    groundMaplink: team.groundId.groundMaplink,
                    image: team.groundId.image,
                    facilities: team.groundId.facilities,
                    location: team.groundId.location,
                    fee: team.groundId.fee
                } : null
            } : null
        };

        res.status(200).json({
            success: true,
            data: profileData
        });

    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user profile',
            error: error.message
        });
    }
};


// Save or update FCM token
exports.updateFcmToken = async (req, res) => {
    const userId = req.user.id; // Make sure this is coming from your auth middleware
    const { fcmToken } = req.body;

    if (!fcmToken) {
        return res.status(400).json({ message: 'FCM token is required' });
    }

    try {
        const user = await User.findByIdAndUpdate(
            userId,
            { fcmToken },
            { new: true }
        ).select('-password');

        res.status(200).json({
            message: 'FCM token updated successfully',
            user
        });
    } catch (error) {
        console.error('Error updating FCM token:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({
            success: false,
            message: 'Email is required'
        });
    }

    let user; // Declare user outside try block so it's accessible in catch

    try {
        user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this email address'
            });
        }

        // Generate 6-digit OTP
        const resetOTP = Math.floor(100000 + Math.random() * 900000).toString();

        // Set OTP and expiration (10 minutes from now)
        user.resetPasswordOTP = resetOTP;
        user.resetPasswordExpires = Date.now() + 600000; // 10 minutes

        await user.save();

        // Email options
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Crickonnect - Password Reset Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #d32f2f; margin: 0;">Crickonnect</h1>
                        <p style="color: #666; margin: 5px 0;">Password Reset Code</p>
                    </div>

                    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center; margin: 20px 0;">
                        <h2 style="color: #333; margin-bottom: 15px;">Hi ${user.name}!</h2>
                        <p style="color: #666; margin-bottom: 25px;">Enter this code in the Crickonnect app to reset your password:</p>

                        <div style="background-color: white; border: 2px solid #d32f2f; border-radius: 8px; padding: 20px; margin: 20px 0; display: inline-block;">
                            <h1 style="color: #d32f2f; margin: 0; font-size: 36px; letter-spacing: 8px; font-family: 'Courier New', monospace;">${resetOTP}</h1>
                        </div>

                        <p style="color: #d32f2f; font-weight: bold; margin-top: 20px;">⏰ This code expires in 10 minutes</p>
                    </div>

                    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                        <p style="color: #856404; margin: 0; font-size: 14px;">
                            <strong>Security Note:</strong> If you didn't request this password reset, please ignore this email. Your account remains secure.
                        </p>
                    </div>

                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        This is an automated email from Crickonnect. Please do not reply to this email.
                    </p>
                </div>
            `
        };

        // Send email
        await transporter.sendMail(mailOptions);

        res.status(200).json({
            success: true,
            message: 'Password reset code sent to your email successfully'
        });

    } catch (error) {
        console.error('Error in forgot password:', error);

        // Reset the fields if email sending fails
        if (user) {
            user.resetPasswordOTP = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
        }

        res.status(500).json({
            success: false,
            message: 'Error sending password reset code'
        });
    }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({
            success: false,
            message: 'Email and OTP are required'
        });
    }

    try {
        const user = await User.findOne({
            email: email,
            resetPasswordOTP: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        res.status(200).json({
            success: true,
            message: 'OTP verified successfully',
            verified: true
        });

    } catch (error) {
        console.error('Error in OTP verification:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying OTP'
        });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        return res.status(400).json({
            success: false,
            message: 'Email, OTP, and new password are required'
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 6 characters long'
        });
    }

    try {
        const user = await User.findOne({
            email: email,
            resetPasswordOTP: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password and clear reset fields
        user.password = hashedPassword;
        user.resetPasswordOTP = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Error in reset password:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting password'
        });
    }
};
