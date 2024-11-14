const Team = require('../models/team');
const Ground = require('../models/ground');

const createTeam = async (req, res) => {
    try {
        const { name, logo, hasGround, groundDescription, groundImage, facilities, groundFee } = req.body;

        // Create a ground if the team has its own ground
        let ground = null;
        if (hasGround) {
            ground = new Ground({
                description: groundDescription,
                image: groundImage,
                facilities: facilities,
                groundFee: groundFee,
            });

            // Save the ground to the database
            await ground.save();
        }

        // Create the team
        const team = new Team({
            name: name,
            logo: logo,
            hasGround: hasGround,
            ground: ground ? ground._id : null,
        });

        // Save the team to the database
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
