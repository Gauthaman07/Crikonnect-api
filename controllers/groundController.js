const Team = require('../models/team');

const getAvailableGrounds = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch the user's team
        const userTeam = await Team.findOne({ createdBy: userId });

        if (!userTeam) {
            return res.status(404).json({ message: 'User has not created a team yet.' });
        }

        if (userTeam.hasOwnGround) {
            // User has their own ground, fetch their bookings and other grounds
            const yourGround = {
                groundDescription: userTeam.groundDescription,
                groundImage: userTeam.groundImage,
                facilities: userTeam.facilities,
                groundFee: userTeam.groundFee,
            };

            const otherGrounds = await Team.find({ hasOwnGround: true, createdBy: { $ne: userId } })
                .select('groundDescription groundImage facilities groundFee teamName location');

            return res.status(200).json({
                message: 'Grounds fetched successfully',
                yourGround,
                otherGrounds,
            });
        } else {
            // User does not have a ground, fetch all other available grounds
            const availableGrounds = await Team.find({ hasOwnGround: true })
                .select('groundDescription groundImage facilities groundFee teamName location');

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
