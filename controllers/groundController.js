const Team = require('../models/team'); // Ensure Team model is imported
const Ground = require('../models/ground'); // Import the Ground model
const GroundBooking = require('../models/groundBooking');

const getAvailableGrounds = async (req, res) => {
    try {
        const userId = req.user.id;
        const { location } = req.query;

        // Fetch the user's team and populate their ground if it exists
        const userTeam = await Team.findOne({ createdBy: userId }).populate('groundId');

        if (!userTeam) {
            return res.status(404).json({ message: 'User has not created a team yet.' });
        }

        let yourGround = null;

        if (userTeam.hasOwnGround && userTeam.groundId) {
            // Fetch pending bookings for your ground
            // Fetch pending bookings for your ground
            const allBookings = await GroundBooking.find({
                groundId: userTeam.groundId._id,
                status: { $in: ['pending', 'booked'] }
            })
                .populate({
                    path: 'bookedByTeam',
                    select: 'teamName teamLogo'  // Select only these fields from the Team model
                })
                .sort({ bookedDate: 1 });  // Sort by date ascending

            // Format bookings for response
            const formattedBookings = allBookings.map(booking => ({
                bookingId: booking._id,
                teamName: booking.bookedByTeam.teamName,
                teamLogo: booking.bookedByTeam.teamLogo,
                date: booking.bookedDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                timeSlot: booking.timeSlot,
                status: booking.status
            }));

            // Prepare user's ground details with bookings
            yourGround = {
                groundName: userTeam.groundId.groundName,
                description: userTeam.groundId.description,
                groundMaplink: userTeam.groundId.groundMaplink,
                image: userTeam.groundId.image,
                facilities: userTeam.groundId.facilities,
                location: userTeam.groundId.location,
                fee: userTeam.groundId.fee,
                pendingBookings: formattedBookings  // Add pending bookings to response
            };
        }

        // Fetch all grounds, filtered by location if provided
        const groundsQuery = location ? { location } : {};
        const allGrounds = await Ground.find(groundsQuery).select(
            'groundName description groundMaplink image facilities location fee createdBy'
        );

        // Fetch bookings made by the user for all grounds
        const userBookings = await GroundBooking.find({
            bookedByTeam: userTeam._id, // Assuming userTeam._id is the team ID
            status: { $in: ['pending', 'booked'] } // Fetch only relevant statuses
        }).populate('groundId');

        // Format user bookings for response
        const formattedUserBookings = userBookings.map(booking => ({
            bookingId: booking._id,
            groundName: booking.groundId.groundName,
            date: booking.bookedDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            timeSlot: booking.timeSlot,
            status: booking.status
        }));

        // Separate the user's own ground from other grounds
        const otherGrounds = allGrounds.filter(
            (ground) => !yourGround || ground._id.toString() !== userTeam.groundId._id.toString()
        );

        // Response
        if (yourGround) {
            res.status(200).json({
                message: 'Grounds fetched successfully.',
                yourGround,
                otherGrounds,
                userBookings: formattedUserBookings // Add user bookings to response
            });
        } else {
            res.status(200).json({
                message: 'Grounds fetched successfully.',
                grounds: allGrounds,
                userBookings: formattedUserBookings // Add user bookings to response
            });
        }
    } catch (error) {
        console.error('Error fetching grounds:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = { getAvailableGrounds };
