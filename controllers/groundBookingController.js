const GroundBooking = require('../models/groundBooking');
const Ground = require('../models/ground');

const bookGround = async (req, res) => {
    try {
        const { groundId, bookedDate, timeSlot } = req.body;
        const teamId = req.user.teamId; // Assuming `req.user` contains team ID from authentication middleware

        // Validate input
        if (!groundId || !bookedDate || !timeSlot) {
            return res.status(400).json({ message: 'Required fields are missing.' });
        }

        // Validate date
        if (isNaN(Date.parse(bookedDate))) {
            return res.status(400).json({ message: 'Invalid date format.' });
        }

        // Validate time slot
        const validSlots = ['Morning', 'Afternoon'];
        if (!validSlots.includes(timeSlot)) {
            return res.status(400).json({ message: 'Invalid time slot.' });
        }

        // Check if the ground exists
        const ground = await Ground.findById(groundId);
        if (!ground) {
            return res.status(404).json({ message: 'Ground not found.' });
        }

        // Check if the time slot is already booked or pending
        const existingBooking = await GroundBooking.findOne({
            groundId,
            bookedDate,
            timeSlot,
            status: { $in: ['pending', 'booked'] },
        });

        if (existingBooking) {
            return res.status(400).json({ message: 'Time slot is not available.' });
        }

        // Create a new booking
        const newBooking = new GroundBooking({
            groundId,
            bookedByTeam: teamId,
            bookedDate,
            timeSlot,
            status: 'pending', // Initially, all bookings are pending
        });

        const savedBooking = await newBooking.save();

        res.status(201).json({ message: 'Booking request created successfully.', booking: savedBooking });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = { bookGround };
