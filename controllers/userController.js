const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');  

// Signup logic (already implemented)
exports.signup = async (req, res) => {
    const {mobile, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords don't match" });
    }

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
