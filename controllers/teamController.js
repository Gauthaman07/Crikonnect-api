const Team = require('../models/team');
const Ground = require('../models/ground');
const Match = require('../models/match');
const GuestMatchRequest = require('../models/guestMatchRequest');

const createTeam = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            teamName,
            location,
            hasOwnGround,
            groundName,
            description,
            groundMaplink,
            facilities,
            groundFee,
        } = req.body;

        const hasGround = hasOwnGround === 'true' || hasOwnGround === true;
        const teamLogo = req.files?.teamLogo[0]?.path;
        const groundImage = req.files?.groundImage?.[0]?.path || null;

        if (!teamName || !teamLogo || !location || hasGround === undefined) {
            return res.status(400).json({ message: 'Required fields are missing.' });
        }

        // Check if user already has a team
        const existingTeam = await Team.findOne({ createdBy: userId });
        if (existingTeam) return res.status(400).json({ message: 'User already has a team.' });

        // Step 1: create team first
        const newTeam = new Team({
            teamName,
            teamLogo,
            location,
            hasOwnGround: hasGround,
            createdBy: userId,
            members: [userId], // Add creator to members array
        });
        const savedTeam = await newTeam.save();

        let groundId = null;

        // Step 2: create ground if user has own ground
        if (hasGround) {
            if (!groundName || !description || !groundMaplink || !facilities || !groundFee || !groundImage) {
                return res.status(400).json({ message: 'Ground details are missing.' });
            }

            const parsedFee = parseFloat(groundFee);
            if (isNaN(parsedFee)) return res.status(400).json({ message: 'Invalid ground fee value.' });

            const newGround = new Ground({
                groundName,
                description,
                groundMaplink,
                image: groundImage,
                facilities,
                location,
                fee: parsedFee,
                createdBy: userId,
                ownedByTeam: savedTeam._id, // ✅ assign team ID here
            });

            const savedGround = await newGround.save();
            groundId = savedGround._id;

            // Step 3: update team with groundId
            savedTeam.groundId = groundId;
            await savedTeam.save();
        }

        res.status(201).json({
            message: 'Team created successfully!',
            team: savedTeam,
        });

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

        // --- Fetch Next Match Logic ---
        const teamId = team._id;
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Include today's matches

        // 1. Find upcoming Tournament Matches
        const tournamentMatches = await Match.find({
            $or: [{ team1: teamId }, { team2: teamId }],
            matchDate: { $gte: now },
            status: 'scheduled'
        }).sort({ matchDate: 1 }).limit(1);

        // 2. Find upcoming Guest Matches (Friendly)
        const guestMatches = await GuestMatchRequest.find({
            $or: [
                { teamA: teamId },
                { teamB: teamId },
                { ownerTeamId: teamId, matchType: 'vs_owner' }
            ],
            requestedDate: { $gte: now },
            status: 'approved'
        }).sort({ requestedDate: 1 }).limit(1);

        // 3. Determine the nearest match
        let nextMatch = null;
        const tMatch = tournamentMatches[0];
        const gMatch = guestMatches[0];

        if (tMatch && gMatch) {
            // Compare dates
            nextMatch = tMatch.matchDate < gMatch.requestedDate ? tMatch : gMatch;
        } else if (tMatch) {
            nextMatch = tMatch;
        } else if (gMatch) {
            nextMatch = gMatch;
        }

        // Format the next match string
        let nextMatchString = null;
        if (nextMatch) {
            const dateObj = nextMatch.matchDate || nextMatch.requestedDate;
            const timeSlot = nextMatch.timeSlot; // 'morning', 'afternoon' or specific time
            
            // Format date: "25 Dec"
            const dateOptions = { day: 'numeric', month: 'short' };
            const dateStr = new Date(dateObj).toLocaleDateString('en-US', dateOptions);
            
            // Format time: Capitalize first letter
            const timeStr = timeSlot.charAt(0).toUpperCase() + timeSlot.slice(1);

            // "25 Dec, Morning"
            nextMatchString = `${dateStr}, ${timeStr}`;
            
            // Check if it's today
            const today = new Date();
            if (dateObj.toDateString() === today.toDateString()) {
                 nextMatchString = `Today, ${timeStr}`;
            }
        }
        // -----------------------------

        // Structure the response
        const response = {
            _id: team._id,
            teamName: team.teamName,
            teamLogo: team.teamLogo,
            location: team.location,
            hasOwnGround: team.hasOwnGround,
            createdBy: team.createdBy,
            nextMatch: nextMatchString, // Add this field
            groundDetails: team.hasOwnGround && team.groundId
                ? {
                    groundName: team.groundId.groundName,
                    description: team.groundId.description,
                    groundMaplink: team.groundId.groundMaplink,
                    image: team.groundId.image,
                    facilities: team.groundId.facilities,
                    location: team.groundId.location,
                    fee: team.groundId.fee,
                }
                : null,
        };

        res.status(200).json({ message: "Team fetched successfully", team: response });
    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

module.exports = { createTeam, getTeamByUser };
