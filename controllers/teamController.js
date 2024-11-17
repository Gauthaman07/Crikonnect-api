const Team = require('../models/team');
const Ground = require('../models/ground');

exports.createTeam = async (req, res) => {
    try {
        // Access the files uploaded by multer
        const { name, hasGround, groundDescription, facilities, groundFee } = req.body;
        const logo = req.files.teamLogo ? req.files.teamLogo[0] : null;   // Access team logo
        const groundImage = req.files.groundImage ? req.files.groundImage[0] : null;   // Access ground image

        // Check if logo is uploaded
        if (!logo) {
            return res.status(400).json({ error: 'Team logo is required.' });
        }

        let ground = null;
        if (hasGround === 'yes') {
            // Validate ground-specific fields if the team has its own ground
            if (!groundDescription || !facilities || !groundFee || !groundImage) {
                return res.status(400).json({ error: 'Ground details (description, facilities, fee, image) are required.' });
            }

            ground = new Ground({
                description: groundDescription,
                image: groundImage.path,   // Save file path for ground image
                facilities: facilities,
                groundFee: groundFee,
            });
            await ground.save();
        }

        // Create the team object with logo file path
        const team = new Team({
            name,
            logo: logo.path,  // Save the logo file path in the database
            hasGround,
            ground: ground ? ground._id : null,  // Reference to ground if available
        });

        await team.save();

        return res.status(201).json({
            message: 'Team created successfully!',
            team,
        });
    } catch (error) {
        console.error('Error during team creation:', error);
        return res.status(500).json({ error: 'Error creating team' });
    }
};


