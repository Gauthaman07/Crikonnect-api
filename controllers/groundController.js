const Team = require('../models/team');
const Ground = require('../models/ground');

const getAvailableGrounds = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch the team associated with the user
        const userTeam = await Team.findOne({ createdBy: userId });

        if (!userTeam) {
            return res.status(404).json({ message: 'User has not created a team yet.' });
        }

        // Check if the user has their own ground
        if (userTeam.hasOwnGround) {
            // Fetch user's ground bookings and all other available grounds
            const userBookings = await Ground.find({ owner: userId });
            const otherAvailableGrounds = await Ground.find({ owner: { $ne: userId } });

            return res.status(200).json({
                message: 'Grounds fetched successfully',
                yourBookings: userBookings,
                otherGrounds: otherAvailableGrounds,
            });
        } else {
            // Fetch all grounds owned by other users
            const availableGrounds = await Ground.find({ owner: { $ne: userId } });

            return res.status(200).json({
                message: 'Available grounds fetched successfully',
                grounds: availableGrounds,
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = { getAvailableGrounds };
