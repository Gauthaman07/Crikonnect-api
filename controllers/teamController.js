const Team = require('../models/team');
const Ground = require('../models/ground');

const createTeam = async (req, res) => {
    try {
        console.log('Request body:', req.body);
        console.log('Files:', req.files);
        console.log('Facilities:', req.body.facilities);

        const userId = req.user.id; // Assuming authentication middleware provides `req.user`
        const {
            teamName,
            location,
            hasOwnGround,
            groundName,
            description,
            groundMaplink,
            facilities,
            groundFee,
        } = req.body;

        // Parse `hasOwnGround` to boolean if it's a string 'true'/'false'
        const hasGround = (hasOwnGround === 'true') || (hasOwnGround === true);

        // Handle file uploads
        const teamLogo = req.files?.teamLogo[0]?.path;
        const groundImage = req.files?.groundImage?.[0]?.path || null;

        // Check for required fields
        if (!teamName || !teamLogo || !location || hasGround === undefined) {
            return res.status(400).json({ message: 'Required fields are missing.' });
        }

        // Check if the user already created a team
        const existingTeam = await Team.findOne({ createdBy: userId });
        if (existingTeam) {
            return res.status(400).json({ message: 'User already has a team.' });
        }

        let groundId = null;

        // Only create ground if the user has their own ground
        if (hasGround) {
            // Ensure all ground details are present
            if (!groundName || !description || !groundMaplink || !facilities || !groundFee || !groundImage) {
                return res.status(400).json({ message: 'Ground details are missing or incomplete.' });
            }

            // Validate facilities as an array of strings
            if (!Array.isArray(facilities)) {
                return res.status(400).json({ message: 'Facilities must be an array of strings.' });
            }

            // Parse fee to ensure it's a number
            const parsedFee = parseFloat(groundFee);
            if (isNaN(parsedFee)) {
                return res.status(400).json({ message: 'Invalid ground fee value.' });
            }

            // Create the ground document
            const newGround = new Ground({
                groundName,
                description,
                groundMaplink,
                image: groundImage,
                facilities,
                location,
                fee: parsedFee,
                createdBy: userId,
            });

            const savedGround = await newGround.save();
            groundId = savedGround._id;
        }

        // Create the team document
        const newTeam = new Team({
            teamName,
            teamLogo,
            location,
            hasOwnGround: hasGround,
            groundId,
            createdBy: userId,
        });

        const savedTeam = await newTeam.save();
        res.status(201).json({ message: 'Team created successfully!', team: savedTeam });
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};


const getTeamByUser = async (req, res) => {
    try {
        const userId = req.user.id; // Extract user ID from the token's payload

        // Find the team associated with the user and populate the ground details if it exists
        const team = await Team.findOne({ createdBy: userId }).populate('groundId');

        if (!team) {
            return res.status(404).json({ message: "No team found for this user." });
        }

        // Structure the response
        const response = {
            _id: team._id,
            teamName: team.teamName,
            teamLogo: team.teamLogo,
            location: team.location,
            hasOwnGround: team.hasOwnGround,
            createdBy: team.createdBy,
            groundDetails: team.hasOwnGround && team.groundId
                ? {
                    groundName: team.groundId.groundName,
                    description: team.groundId.description,
                    groundMaplink: team.groundId.groundMaplink,
                    image: team.groundId.image,
                    facilities: team.groundId.facilities,
                    location: team.groundId.location,
                    fee: team.groundId.fee,
                }
                : null,
        };

        res.status(200).json({ message: "Team fetched successfully", team: response });
    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

module.exports = { createTeam, getTeamByUser };
