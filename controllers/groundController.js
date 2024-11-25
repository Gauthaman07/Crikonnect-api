const Team = require('../models/team');

const getAvailableGrounds = async (req, res) => {
    try {
        const userId = req.user.id; // Assuming user authentication middleware provides `req.user`

        // Fetch the user's team
        const userTeam = await Team.findOne({ createdBy: userId });

        if (!userTeam) {
            return res.status(404).json({ message: 'User has not created a team yet.' });
        }

        // Fetch all grounds except the user's ground (if it exists)
        const otherGrounds = await Team.find({
            hasOwnGround: true,
            createdBy: { $ne: userId },
        }).select('groundDescription groundImage facilities groundFee teamName location');

        if (userTeam.hasOwnGround) {
            // User has their own ground
            const yourGround = {
                groundDescription: userTeam.groundDescription,
                groundImage: userTeam.groundImage,
                facilities: userTeam.facilities || [],
                groundFee: userTeam.groundFee,
            };

            return res.status(200).json({
                message: 'Available grounds fetched successfully',
                grounds: otherGrounds,
                yourGround,
            });
        } else {
            // User does not have their own ground
            return res.status(200).json({
                message: 'Available grounds fetched successfully',
                grounds: otherGrounds,
            });
        }
    } catch (error) {
        console.error('Error fetching grounds:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = { getAvailableGrounds };
