const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Team = require('../models/team');    // Add this line
const Ground = require('../models/ground');

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
            user: { email: user.email, mobile: user.mobile }
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