const GroundBooking = require('../models/groundBooking');
const Ground = require('../models/ground');
const Team = require('../models/team');

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

        res.status(201).json({ 
            success: true,
            message: 'Booking request created successfully.', 
            booking: savedBooking 
        });

    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error', 
            error: error.message 
        });
    }
};