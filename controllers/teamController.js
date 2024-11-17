const Team = require('../models/team');
const Ground = require('../models/ground');

exports.createTeam = async (req, res) => {
    try {
        const { name, hasGround, groundDescription, facilities, groundFee } = req.body;
        const logo = req.files.teamLogo ? req.files.teamLogo[0] : null; // Get the team logo from the request
        const groundImage = req.files.groundImage ? req.files.groundImage[0] : null; // Get the ground image if available

        // Check if logo is uploaded
        if (!logo) {
            return res.status(400).json({ error: 'Team logo is required.' });
        }

        // If the team has its own ground, validate additional fields
        let ground = null;
        if (hasGround === 'yes') {
            // Only if hasGround is 'yes', validate ground-specific fields
            if (!groundDescription || !facilities || !groundFee || !groundImage) {
                return res.status(400).json({ error: 'Ground details (description, facilities, fee, image) are required.' });
            }

            ground = new Ground({
                description: groundDescription,
                image: groundImage.path, // Save the file path if groundImage is provided
                facilities: facilities,
                groundFee: groundFee,
            });
            await ground.save();
        }

        // Create the team with the necessary fields
        const team = new Team({
            name,
            logo: logo.path, // Save the file path in the database
            hasGround,       // Save if the team has a ground
            ground: ground ? ground._id : null,  // Save ground reference if applicable
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

