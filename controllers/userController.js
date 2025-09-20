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
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found with this email address' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Set token and expiration (1 hour from now)
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        await user.save();

        // Create reset URL (you can modify this to match your frontend URL)
        const resetUrl = `https://crikonnect-api.onrender.com/api/auth/reset-password?token=${resetToken}`;

        // Email options
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Crickonnect - Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #d32f2f;">Crickonnect Password Reset</h2>
                    <p>Hi ${user.name},</p>
                    <p>You requested a password reset for your Crickonnect account.</p>
                    <p>Click the button below to reset your password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background-color: #d32f2f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                    </div>
                    <p>Or copy and paste this link in your browser:</p>
                    <p style="word-break: break-all; color: #666;">${resetUrl}</p>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request this password reset, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #666; font-size: 12px;">
                        This is an automated email from Crickonnect. Please do not reply to this email.
                    </p>
                </div>
            `
        };

        // Send email
        await transporter.sendMail(mailOptions);

        res.status(200).json({
            message: 'Password reset email sent successfully'
        });

    } catch (error) {
        console.error('Error in forgot password:', error);

        // Reset the fields if email sending fails
        if (user) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
        }

        res.status(500).json({ message: 'Error sending password reset email' });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password and clear reset fields
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.status(200).json({
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Error in reset password:', error);
        res.status(500).json({ message: 'Error resetting password' });
    }
};
