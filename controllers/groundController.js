const Ground = require('../models/ground');
const Team = require('../models/team');

const getAvailableGrounds = async (req, res) => {
    try {
        const userId = req.user.id; // Extract user info from auth middleware
        const { location } = req.query; // Extract location from query string

        if (!location) {
            return res.status(400).json({ message: "Location query parameter is required." });
        }

        // Find the team of the logged-in user
        const userTeam = await Team.findOne({ createdBy: userId });

        if (!userTeam) {
            return res.status(404).json({ message: "User has no team associated." });
        }

        // Fetch all grounds
        const grounds = await Ground.find();

        if (grounds.length === 0) {
            return res.status(404).json({ message: `No grounds available.` });
        }

        if (!userTeam.hasOwnGround) {
            // Case 1: User's team does NOT have its own ground
            return res.status(200).json({
                message: `Available grounds fetched successfully`,
                grounds,
            });
        } else {
            // Case 2: User's team has its own ground (fetch all + check bookings)
            const userGroundDetails = {
                description: userTeam.groundDescription || "No description",
                image: userTeam.groundImage || "No image",
                facilities: userTeam.facilities || [],
                groundFee: userTeam.groundFee || 0,
            };

            return res.status(200).json({
                message: `Grounds and booking details fetched successfully`,
                userGroundDetails,
                otherAvailableGrounds: grounds,
            });
        }
    } catch (error) {
        console.error("Error fetching grounds:", error.message);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

module.exports = { getAvailableGrounds };
