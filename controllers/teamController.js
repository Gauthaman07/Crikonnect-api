const Team = require('../models/team');
const Ground = require('../models/ground');

exports.createTeam = async (req, res) => {
    try {
        const { name, hasGround, groundDescription, facilities, groundFee } = req.body;
        const logo = req.files.teamLogo ? req.files.teamLogo[0] : null; // Get the team logo
        const groundImage = req.files.groundImage ? req.files.groundImage[0] : null; // Get the ground image if available

        console.log('Received logo:', logo);
        console.log('Received groundImage:', groundImage);
        console.log('Team details:', { name, hasGround, groundDescription, facilities, groundFee });

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

            // If all required fields are provided, create the ground
            ground = new Ground({
                description: groundDescription,
                image: groundImage.path,  // Save the file path for the ground image
                facilities: facilities.split(','), // Split facilities if it's a comma-separated string
                groundFee: groundFee,
            });
            await ground.save();
            console.log('Ground saved:', ground);
        }

        // Create the team object
        const team = new Team({
            name,
            logo: logo.path,  // Save the logo file path in the database
            hasGround,
            ground: ground ? ground._id : null,  // If the team has a ground, save the reference
        });

        await team.save();
        console.log('Team saved:', team);

        return res.status(201).json({
            message: 'Team created successfully!',
            team,
        });
    } catch (error) {
        console.error('Error during team creation:', error);
        return res.status(500).json({ error: 'Error creating team' });
    }
};



