const GroundBooking = require('../models/groundBooking');
const Ground = require('../models/ground');
const Team = require('../models/team');
const User = require('../models/User');
const transporter = require('../config/emailConfig');


exports.bookGround = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { groundId, bookedDate, timeSlot, bookedByTeam } = req.body;
        const userId = req.user.id;

        // Validation checks for required fields
        if (!groundId || !bookedDate || !timeSlot || !bookedByTeam) {
            return res.status(400).json({ message: 'Required fields are missing.' });
        }

        // Validate time slot
        const validSlots = ['morning', 'afternoon'];
        if (!validSlots.includes(timeSlot)) {
            return res.status(400).json({ 
                message: 'Invalid time slot. Must be either "Morning" or "Afternoon".' 
            });
        }

        // Check if ground exists
        const ground = await Ground.findById(groundId);
        if (!ground) {
            return res.status(404).json({ message: 'Ground not found.' });
        }

        // Verify the team exists and user is part of it
        const team = await Team.findOne({
            _id: bookedByTeam,
            $or: [
                { createdBy: userId },
                { members: userId }
            ]
        });

        if (!team) {
            return res.status(403).json({ 
                message: 'You are not authorized to book for this team.' 
            });
        }

        // Check if the time slot is already booked
        const existingBooking = await GroundBooking.findOne({
            groundId,
            bookedDate,
            timeSlot,
            status: { $in: ['pending', 'booked'] }
        });

        if (existingBooking) {
            return res.status(400).json({ 
                message: 'This time slot is already booked or pending.' 
            });
        }

        // Create new booking
        const newBooking = new GroundBooking({
            groundId,
            bookedByTeam,
            bookedDate,
            timeSlot,
            status: 'pending'
        });

        const savedBooking = await newBooking.save();

        // const ground = await Ground.findById(groundId);
        const groundOwner = await User.findById(ground.createdBy);
        
        // Fetch requesting team's details
        const requestingTeam = await Team.findById(bookedByTeam);

        // Format date for email
        const formattedDate = new Date(bookedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        try {
            console.log('Attempting to send email...');
            console.log('Ground owner email:', groundOwner.email);
            
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: groundOwner.email,
                subject: 'New Ground Booking Request',
                html: `
                    <h2>New Booking Request</h2>
                    <p>You have received a new booking request for your ground.</p>
                    <h3>Booking Details:</h3>
                    <ul>
                        <li><strong>Team:</strong> ${team.teamName}</li>
                        <li><strong>Date:</strong> ${formattedDate}</li>
                        <li><strong>Time Slot:</strong> ${timeSlot}</li>
                        <li><strong>Ground:</strong> ${ground.groundName}</li>
                    </ul>
                    <p>Please log in to your account to approve or reject this request.</p>
                `
            };

            console.log('Mail options:', mailOptions);

            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info);

            res.status(201).json({ 
                success: true,
                message: 'Booking request created successfully and notification sent.', 
                booking: savedBooking 
            });

        } catch (emailError) {
            console.error('Email sending error:', emailError);
            res.status(201).json({
                success: true,
                message: 'Booking created successfully, but email notification failed.',
                booking: savedBooking,
                emailError: emailError.message
            });
        }

    } catch (error) {
        console.error('Error in booking process:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error', 
            error: error.message 
        });
    }
};