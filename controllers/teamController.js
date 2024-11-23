const Team = require('../models/team');

const createTeam = async (req, res) => {
    try {
        const userId = req.user.id; // Assuming user info is in `req.user`
        const {
            teamName,
            hasOwnGround,
            groundDescription,
            facilities,
            groundFee,
        } = req.body;

        const teamLogo = req.files?.teamLogo[0]?.path;
        const groundImage = req.files?.groundImage?.[0]?.path || null;

        if (!teamName || !teamLogo || hasOwnGround === undefined) {
            return res.status(400).json({ message: 'Required fields are missing.' });
        }

        // Check if the user already created a team
        const existingTeam = await Team.findOne({ createdBy: userId });
        if (existingTeam) {
            return res.status(400).json({ message: 'User already has a team.' });
        }

        const newTeam = new Team({
            teamName,
            teamLogo,
            hasOwnGround: hasOwnGround === 'true',
            groundDescription: hasOwnGround === 'true' ? groundDescription : null,
            groundImage: hasOwnGround === 'true' ? groundImage : null,
            facilities: hasOwnGround === 'true' ? facilities : [],
            groundFee: hasOwnGround === 'true' ? groundFee : null,
            createdBy: userId, // Associate the team with the user
        });

        await newTeam.save();
        res.status(201).json({ message: 'Team created successfully!', team: newTeam });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};



const getTeamByUser = async (req, res) => {
    try {
        const userId = req.user.id;
        const team = await Team.findOne({ createdBy: userId });

        if (!team) {
            return res.status(404).json({ message: "No team found for this user." });
        }

        res.status(200).json(team);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

module.exports = { createTeam, getTeamByUser };



