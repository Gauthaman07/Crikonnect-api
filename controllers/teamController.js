const Team = require('../models/team');
const Ground = require('../models/ground');

// Create a team
const createTeam = async (req, res) => {
    try {
        const { name, hasGround, groundDescription, facilities, groundFee } = req.body;
        const logo = req.file;  // Get the uploaded file from the request

        // Check if logo is uploaded
        if (!logo) {
            return res.status(400).json({ error: 'Team logo is required.' });
        }

        // Create a ground if the team has its own ground
        let ground = null;
        if (hasGround === 'yes') {
            const { groundImage, groundDescription, facilities, groundFee } = req.body;
            ground = new Ground({
                description: groundDescription,
                image: groundImage,
                facilities: facilities,
                groundFee: groundFee,
            });
            await ground.save();
        }

        // Create the team
        const team = new Team({
            name,
            logo: logo.path, // Save the file path in the database
            hasGround,
            ground: ground ? ground._id : null,
        });

        await team.save();

        return res.status(201).json({
            message: 'Team created successfully!',
            team,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error creating team' });
    }
};

module.exports = { createTeam };
