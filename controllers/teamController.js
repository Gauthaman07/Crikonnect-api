
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

        const teamLogo = req.files?.teamLogo[0]?.path;
        const groundImage = req.files?.groundImage?.[0]?.path || null;

        if (!teamName || !teamLogo || hasOwnGround === undefined) {
            return res.status(400).json({ message: 'Required fields are missing.' });
        }

        const newTeam = new Team({
            teamName,
            teamLogo,
            hasOwnGround,
            groundDescription: hasOwnGround === 'true' ? groundDescription : null,
            groundImage: hasOwnGround === 'true' ? groundImage : null,
            facilities: hasOwnGround === 'true' ? facilities : [],
            groundFee: hasOwnGround === 'true' ? groundFee : null,
        });

        await newTeam.save();
        res.status(201).json({ message: 'Team created successfully!', team: newTeam });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = { createTeam };
