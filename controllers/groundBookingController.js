const GroundBooking = require('../models/groundBooking');
const Ground = require('../models/ground');
const Team = require('../models/team');
const User = require('../models/User');
const transporter = require('../config/emailConfig');
const axios = require('axios');

exports.bookGround = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { groundId, bookedDate, timeSlot, bookedByTeam } = req.body;
        const userId = req.user.id;

        // Validation checks for required fields
        if (!groundId || !bookedDate || !timeSlot || !bookedByTeam) {
            return res.status(400).json({ message: 'Required fields are missing.' });
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
                message: 'You must be a member or owner of the team to make a booking.'
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

        // Get ground owner's details for email and WhatsApp
        const groundOwner = await User.findById(ground.createdBy);

        // Format date for notifications
        const formattedDate = new Date(bookedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Send email notification
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

        await transporter.sendMail(mailOptions);

        console.log('GUPSHUP_API_KEY:', process.env.GUPSHUP_API_KEY);
        console.log('GUPSHUP_SOURCE_NUMBER:', process.env.GUPSHUP_SOURCE_NUMBER);
        // Send WhatsApp notification using Gupshup
        try {
            const gupshupResponse = await axios.post(
                'https://api.gupshup.io/sm/api/v1/msg',
                {
                    channel: 'whatsapp',
                    source: process.env.GUPSHUP_SOURCE_NUMBER,
                    destination: `+91${groundOwner.mobile}`, // Add correct format
                    message: {
                        type: "template",
                        template: {
                            name: "ground_booking_request",
                            language: "en",
                            params: [
                                groundOwner.name, // Customer Name
                                team.teamName,    // Team Name
                                ground.groundName, // Ground
                                formattedDate,    // Date
                                timeSlot          // Session
                            ]
                        }
                    }
                },
                {
                    headers: {
                        apikey: process.env.GUPSHUP_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('WhatsApp message sent successfully:', gupshupResponse.data);
        } catch (error) {
            console.error('Failed to send WhatsApp message:', error.response?.data || error.message)
        }

        res.status(201).json({
            success: true,
            message: 'Booking request created successfully. Notifications sent.',
            booking: savedBooking
        });
    } catch (error) {
        console.error('Error in booking process:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};



// Add this to your existing groundBookingController.js
exports.updateBookingStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body; // 'booked' or 'rejected'
        const userId = req.user.id;

        // Validate status
        if (!['booked', 'rejected'].includes(status)) {
            return res.status(400).json({
                message: 'Invalid status. Must be either "booked" or "rejected".'
            });
        }

        // Find the booking
        const booking = await GroundBooking.findById(bookingId)
            .populate('groundId')
            .populate('bookedByTeam');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        // Verify that the user owns the ground
        const userTeam = await Team.findOne({
            createdBy: userId,
            groundId: booking.groundId._id
        });

        if (!userTeam) {
            return res.status(403).json({
                message: 'Only the ground owner can approve or reject bookings.'
            });
        }

        // Update booking status
        booking.status = status;
        await booking.save();

        // Find the team that requested the booking to get their details
        const requestingTeam = await Team.findById(booking.bookedByTeam._id)
            .populate('createdBy', 'email'); // Get team creator's email

        // Format date for email
        const formattedDate = new Date(booking.bookedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Send email notification
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: requestingTeam.createdBy.email,
                subject: `Ground Booking ${status === 'booked' ? 'Accepted' : 'Rejected'}`,
                html: `
                    <h2>Booking ${status === 'booked' ? 'Accepted' : 'Rejected'}</h2>
                    <p>Your ground booking request has been ${status === 'booked' ? 'accepted' : 'rejected'}.</p>
                    <h3>Booking Details:</h3>
                    <ul>
                        <li><strong>Ground:</strong> ${booking.groundId.groundName}</li>
                        <li><strong>Date:</strong> ${formattedDate}</li>
                        <li><strong>Time Slot:</strong> ${booking.timeSlot}</li>
                        ${status === 'booked' ? `
                        <li><strong>Fee:</strong> ${booking.groundId.fee}</li>
                        <li><strong>Location:</strong> ${booking.groundId.location}</li>
                        <li><strong>Ground Map Link:</strong> <a href="${booking.groundId.groundMaplink}">Click here</a></li>
                        ` : ''}
                    </ul>
                    ${status === 'booked' ?
                        '<p>Please arrive on time and follow all ground rules.</p>' :
                        '<p>Please try booking another available slot or ground.</p>'
                    }
                `
            };

            await transporter.sendMail(mailOptions);

            res.status(200).json({
                success: true,
                message: `Booking ${status === 'booked' ? 'accepted' : 'rejected'} successfully and notification sent.`,
                booking
            });

        } catch (emailError) {
            console.error('Email sending error:', emailError);
            res.status(200).json({
                success: true,
                message: `Booking ${status === 'booked' ? 'accepted' : 'rejected'} successfully but email notification failed.`,
                booking,
                emailError: emailError.message
            });
        }

    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};