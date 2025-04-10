const Tournament = require('../models/tournament');
const Team = require('../models/team');
const Match = require('../models/match'); // Import the Match model

exports.createTournament = async (req, res) => {
    try {
        const {
            tournamentName,
            tournamentType,
            location,
            groundName,
            organizerName,
            contactDetails,
            startDate,
            endDate,
            matchDaysPreference,
            sessionsAvailable,
            numberOfTeams,
            oversPerMatch,
            ballType,
            entryFee,
            winningPrize,
            playerEligibility,
            teamComposition,
            rulesDocument,
            umpireProvided,
            lastDateToRegister,
            autoFixtureGeneration
        } = req.body;

        const userId = req.user.id; // Assuming user is authenticated

        // Create a new tournament
        const newTournament = new Tournament({
            tournamentName,
            tournamentType,
            location,
            groundName,
            organizerName,
            contactDetails,
            startDate,
            endDate,
            matchDaysPreference,
            sessionsAvailable,
            numberOfTeams,
            oversPerMatch,
            ballType,
            entryFee,
            winningPrize,
            playerEligibility,
            teamComposition,
            rulesDocument,
            umpireProvided,
            lastDateToRegister,
            createdBy: userId
        });

        const savedTournament = await newTournament.save();

        // Link the user's team to the tournament
        const userTeam = await Team.findOne({ createdBy: userId });
        if (userTeam) {
            userTeam.tournaments.push(savedTournament._id);
            await userTeam.save();
        }

        // Generate fixtures if autoFixtureGeneration is enabled
        if (autoFixtureGeneration) {
            await generateFixtures(savedTournament);
        }

        res.status(201).json({
            success: true,
            message: 'Tournament created successfully.',
            tournament: savedTournament
        });
    } catch (error) {
        console.error('Error creating tournament:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Function to generate fixtures based on tournament type
const generateFixtures = async (tournament) => {
    const teams = await Team.find({ _id: { $in: tournament.teams } }); // Fetch teams participating in the tournament
    const matchDays = tournament.matchDaysPreference.split(','); // Assuming it's a comma-separated string
    const sessionTimes = tournament.sessionsAvailable; // e.g., ['morning', 'afternoon']

    if (tournament.tournamentType === 'knockout') {
        // Knockout logic
        let roundTeams = [...teams];
        let round = 1;

        while (roundTeams.length > 1) {
            const matches = [];
            for (let i = 0; i < roundTeams.length; i += 2) {
                if (i + 1 < roundTeams.length) {
                    const matchDate = getNextMatchDate(round, matchDays);
                    const timeSlot = sessionTimes[Math.floor(Math.random() * sessionTimes.length)];
                    const venue = tournament.groundName; // Assuming a single venue for simplicity

                    matches.push(new Match({
                        tournamentId: tournament._id,
                        team1: roundTeams[i]._id,
                        team2: roundTeams[i + 1]._id,
                        matchDate,
                        timeSlot,
                        venue
                    }));
                }
            }
            await Match.insertMany(matches); // Save all matches for this round
            roundTeams = matches.map(match => match.team1); // Advance winners (for simplicity, we assume team1 wins)
            round++;
        }
    } else if (tournament.tournamentType === 'round-robin') {
        // Round-robin logic
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                const matchDate = getNextMatchDate(1, matchDays); // For simplicity, all matches on the same day
                const timeSlot = sessionTimes[Math.floor(Math.random() * sessionTimes.length)];
                const venue = tournament.groundName;

                await Match.create({
                    tournamentId: tournament._id,
                    team1: teams[i]._id,
                    team2: teams[j]._id,
                    matchDate,
                    timeSlot,
                    venue
                });
            }
        }
    }
};

// Helper function to get the next match date based on round and match days preference
const getNextMatchDate = (round, matchDays) => {
    const today = new Date();
    const nextMatchDay = new Date(today);
    nextMatchDay.setDate(today.getDate() + (round * 7)); // Example: schedule matches weekly
    return nextMatchDay;
};


exports.getTournamentsByLocation = async (req, res) => {
    try {
        const { location } = req.query; // Get the location from query parameters
        const userId = req.user ? req.user._id : null; // Get the user ID from the authenticated user

        if (!location) {
            return res.status(400).json({ message: 'Location query parameter is required.' });
        }

        // Find tournaments that match the specified location
        const tournaments = await Tournament.find({ location: new RegExp(location, 'i') }); // Case-insensitive search

        if (tournaments.length === 0) {
            return res.status(404).json({ message: 'No tournaments found for the specified location.' });
        }

        // Separate user's tournaments from the rest
        let userTournaments = [];
        let otherTournaments = [];

        if (userId) {
            userTournaments = tournaments.filter(tournament => tournament.createdBy.toString() === userId.toString());
            otherTournaments = tournaments.filter(tournament => tournament.createdBy.toString() !== userId.toString());
        } else {
            otherTournaments = tournaments; // If user is not authenticated, all tournaments are "other"
        }

        res.status(200).json({
            success: true,
            userTournaments, // Tournaments created by the user
            otherTournaments // All other tournaments
        });
    } catch (error) {
        console.error('Error retrieving tournaments:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};
