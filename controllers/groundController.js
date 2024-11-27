const Team = require('../models/team'); // Ensure Team model is imported
const Ground = require('../models/ground'); // Import the Ground model

const getAvailableGrounds = async (req, res) => {
    try {
        const userId = req.user.id; // Assuming user authentication middleware provides `req.user`
        const { location } = req.query; // Filter by location if provided

        // Fetch the user's team and populate their ground if it exists
        const userTeam = await Team.findOne({ createdBy: userId }).populate('groundId');

        if (!userTeam) {
            return res.status(404).json({ message: 'User has not created a team yet.' });
        }

        let yourGround = null;

        if (userTeam.hasOwnGround && userTeam.groundId) {
            // Prepare user's ground details
            yourGround = {
                groundName: userTeam.groundId.groundName,
                description: userTeam.groundId.description,
                image: userTeam.groundId.image,
                facilities: userTeam.groundId.facilities,
                location: userTeam.groundId.location,
                fee: userTeam.groundId.fee,
            };
        }

        // Fetch all grounds, filtered by location if provided
        const groundsQuery = location ? { location } : {};
        const allGrounds = await Ground.find(groundsQuery).select(
            'groundName description image facilities location fee createdBy'
        );

        // Separate the user's own ground from other grounds (for ground-owning teams)
        const otherGrounds = allGrounds.filter(
            (ground) => !yourGround || ground._id.toString() !== userTeam.groundId._id.toString()
        );

        // Response
        if (yourGround) {
            res.status(200).json({
                message: 'Grounds fetched successfully.',
                yourGround,
                otherGrounds,
            });
        } else {
            res.status(200).json({
                message: 'Grounds fetched successfully.',
                grounds: allGrounds,
            });
        }
    } catch (error) {
        console.error('Error fetching grounds:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = { getAvailableGrounds };
