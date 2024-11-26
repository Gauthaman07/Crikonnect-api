const Team = require('../models/team');
const Ground = require('../models/ground');

const createTeam = async (req, res) => {
    try {
        const userId = req.user.id; // Assuming authentication middleware provides `req.user`
        const {
            teamName,
            location,
            hasOwnGround,
            groundName,
            description,
            facilities,
            fee,
        } = req.body;

        const teamLogo = req.files?.teamLogo[0]?.path;
        const groundImage = req.files?.groundImage?.[0]?.path || null;

        if (!teamName || !teamLogo || !location || hasOwnGround === undefined) {
            return res.status(400).json({ message: 'Required fields are missing.' });
        }

        // Check if the user already created a team
        const existingTeam = await Team.findOne({ createdBy: userId });
        if (existingTeam) {
            return res.status(400).json({ message: 'User already has a team.' });
        }

        let groundId = null;

        if (hasOwnGround === 'true' || hasOwnGround === true) {
            // Validate ground fields
            if (!groundName || !description || !facilities || !fee || !groundImage) {
                return res.status(400).json({ message: 'Ground details are missing or incomplete.' });
            }

            // Create a new ground document
            const newGround = new Ground({
                groundName,
                description,
                image: groundImage,
                facilities,
                location,
                fee,
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
            hasOwnGround: hasOwnGround === 'true',
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
                    image: team.groundId.image,
                    facilities: team.groundId.facilities,
                    location: team.groundId.location,
                    fee: team.groundId.fee,
                }
                : null,
        };

        res.status(200).json({ message: "Team fetched successfully", team: response });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


module.exports = { createTeam, getTeamByUser };



