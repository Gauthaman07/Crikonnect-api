const Team = require('../models/team');
const Ground = require('../models/ground');
const GroundBooking = require('../models/groundBooking');

const getAvailableGrounds = async (req, res) => {
    try {
        const userId = req.user.id;
        const { location } = req.query;

        // Get user's team and its ground
        const userTeam = await Team.findOne({ createdBy: userId }).populate('groundId');

        if (!userTeam) {
            return res.status(404).json({ message: 'User has not created a team yet.' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let yourGround = null;

        if (userTeam.hasOwnGround && userTeam.groundId) {
            const allBookings = await GroundBooking.find({
                groundId: userTeam.groundId._id,
                status: { $in: ['pending', 'booked'] },
                bookedDate: { $gte: today }
            })
                .populate({
                    path: 'bookedByTeam',
                    select: 'teamName teamLogo'
                })
                .sort({ bookedDate: 1 });

            const formattedBookings = allBookings.map(booking => ({
                bookingId: booking._id,
                teamName: booking.bookedByTeam?.teamName || 'Unknown Team',
                teamLogo: booking.bookedByTeam?.teamLogo || null,
                date: booking.bookedDate?.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                timeSlot: booking.timeSlot,
                status: booking.status
            }));

            yourGround = {
                groundName: userTeam.groundId?.groundName || 'Unnamed Ground',
                description: userTeam.groundId?.description || '',
                groundMaplink: userTeam.groundId?.groundMaplink || '',
                image: userTeam.groundId?.image || '',
                facilities: userTeam.groundId?.facilities || [],
                location: userTeam.groundId?.location || '',
                fee: userTeam.groundId?.fee || 0,
                pendingBookings: formattedBookings
            };
        }

        // Get all grounds (optionally filter by location)
        const groundsQuery = location ? { location } : {};
        const allGrounds = await Ground.find(groundsQuery)
            .populate({ path: 'ownedByTeam', select: 'teamName teamLogo' })
            .select('groundName description groundMaplink image facilities location fee createdBy ownedByTeam');

        // Get this user's team bookings
        const userBookings = await GroundBooking.find({
            bookedByTeam: userTeam._id,
            status: { $in: ['pending', 'booked'] },
            bookedDate: { $gte: today }
        }).populate('groundId');

        const formattedUserBookings = userBookings.map(booking => ({
            bookingId: booking._id,
            groundName: booking.groundId?.groundName || 'Unknown Ground',
            groundImg: booking.groundId?.image || '',
            groundFee: booking.groundId?.fee || 0,
            teamName: userTeam.teamName,
            date: booking.bookedDate?.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            timeSlot: booking.timeSlot,
            status: booking.status
        }));

        const otherGrounds = allGrounds.filter(ground =>
            !yourGround || ground._id.toString() !== userTeam.groundId?._id?.toString()
        );

        // ✅ Send safe structured response
        if (yourGround) {
            return res.status(200).json({
                message: 'Grounds fetched successfully.',
                yourGround,
                otherGrounds,
                userBookings: formattedUserBookings
            });
        } else {
            return res.status(200).json({
                message: 'Grounds fetched successfully.',
                grounds: allGrounds,
                userBookings: formattedUserBookings
            });
        }
    } catch (error) {
        console.error('🔥 Error fetching grounds:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = { getAvailableGrounds };
