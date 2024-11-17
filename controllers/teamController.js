const Team = require("../models/team");
const Ground = require("../models/ground");

const createTeam = async (req, res) => {
    try {
        const { name, hasGround, groundDescription, facilities, groundFee } = req.body;

        // Handle uploaded files
        const teamLogo = req.files?.teamLogo?.[0]?.path; // File path for team logo
        let groundImage = null;

        // Validate required fields
        if (!name || !teamLogo || !hasGround) {
            return res.status(400).json({ error: "Required fields are missing" });
        }

        // Create ground if the team has its own ground
        let ground = null;
        if (hasGround === "yes") {
            groundImage = req.files?.groundImage?.[0]?.path; // File path for ground image
            if (!groundDescription || !groundImage || !facilities || !groundFee) {
                return res.status(400).json({ error: "Ground details are incomplete" });
            }

            ground = new Ground({
                description: groundDescription,
                image: groundImage,
                facilities,
                groundFee: parseFloat(groundFee),
            });

            // Save ground to the database
            await ground.save();
        }

        // Create the team
        const team = new Team({
            name,
            logo: teamLogo,
            hasGround: hasGround === "yes",
            ground: ground ? ground._id : null,
        });

        // Save team to the database
        await team.save();

        return res.status(201).json({
            message: "Team created successfully!",
            team,
        });
    } catch (error) {
        console.error("Error in createTeam:", error);
        return res.status(500).json({ error: "Error creating team" });
    }
};

module.exports = { createTeam };
