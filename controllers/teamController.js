const Team = require('../models/team');

const createTeam = async (req, res) => {
    try {
        const {
            teamName,
            hasOwnGround,
            groundDescription,
            facilities,
            groundFee,
        } = req.body;

        const teamLogo = req.files?.teamLogo?.[0]?.path || null;
        const groundImage = req.files?.groundImage?.[0]?.path || null;

        // Validate required fields
        if (!teamName || !teamLogo || hasOwnGround === undefined) {
            return res.status(400).json({ message: 'Required fields are missing.' });
        }

        // Convert `hasOwnGround` to Boolean
        const hasGroundBoolean = hasOwnGround === 'true';

        // Create the team object
        const newTeam = new Team({
            teamName,
            teamLogo,
            hasOwnGround: hasGroundBoolean,
            groundDescription: hasGroundBoolean ? groundDescription : null,
            groundImage: hasGroundBoolean ? groundImage : null,
            facilities: hasGroundBoolean ? facilities : [],
            groundFee: hasGroundBoolean ? groundFee : null,
        });

        // Save the team to the database
        await newTeam.save();

        res.status(201).json({ message: 'Team created successfully!', team: newTeam });
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = { createTeam };

