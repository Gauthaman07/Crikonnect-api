const Tournament = require('../models/tournament');
const Team = require('../models/team');
const Match = require('../models/match'); // Import the Match model
const TeamTournamentRegistration = require('../models/TeamTournamentRegistration');
const User = require('../models/User');
const { sendPushNotification } = require('../services/notificationService');

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
            autoFixtureGeneration,
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


const generateFixtures = async (tournament) => {
    const registrations = await TeamTournamentRegistration.find({
        tournament: tournament._id,
        status: 'approved' // Use 'pending' if auto-approved
    }).populate('team');

    const teams = registrations.map(r => r.team);

    const matchDays = tournament.matchDaysPreference.split(','); // e.g., ['Sunday']
    const sessionTimes = tournament.sessionsAvailable; // e.g., ['morning', 'afternoon']

    if (teams.length < 2) {
        console.log('Not enough teams to generate fixtures');
        return;
    }

    if (tournament.tournamentType === 'knockout') {
        let roundTeams = [...teams];
        let round = 1;

        while (roundTeams.length > 1) {
            const matches = [];

            for (let i = 0; i < roundTeams.length; i += 2) {
                if (i + 1 < roundTeams.length) {
                    const matchDate = getNextMatchDate(round, matchDays); // You need to define this
                    const timeSlot = sessionTimes[Math.floor(Math.random() * sessionTimes.length)];
                    const venue = tournament.groundName;

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

            await Match.insertMany(matches);
            roundTeams = matches.map(match => match.team1); // For now assume team1 wins
            round++;
        }

    } else if (tournament.tournamentType === 'round-robin') {
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                const matchDate = getNextMatchDate(1, matchDays); // Simplified
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




exports.getTournamentsByLocation = async (req, res) => {
    try {
        const { location } = req.query;
        const userId = req.user ? req.user.id : null;

        if (!location) {
            return res.status(400).json({ message: 'Location query parameter is required.' });
        }

        const locationRegex = new RegExp(location, 'i');

        // Filter tournaments with startDate > today
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const baseQuery = {
            location: locationRegex,
            startDate: { $gte: tomorrow }, // Only future tournaments
        };

        let userTournaments = [];
        let otherTournaments = [];

        if (userId) {
            userTournaments = await Tournament.find({
                ...baseQuery,
                createdBy: userId,
            }).populate('createdBy');

            otherTournaments = await Tournament.find({
                ...baseQuery,
                createdBy: { $ne: userId },
            }).populate('createdBy');
        } else {
            otherTournaments = await Tournament.find(baseQuery).populate('createdBy');
        }

        if (userTournaments.length === 0 && otherTournaments.length === 0) {
            return res.status(404).json({ message: 'No upcoming tournaments found for the specified location.' });
        }

        res.status(200).json({
            success: true,
            userTournaments,
            otherTournaments,
        });
    } catch (error) {
        console.error('Error retrieving tournaments:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};






// POST /api/tournaments/:tournamentId/registrations

exports.registerForTournament = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const userId = req.user.id;

        const {
            teamId,
            preferredSlot,
            numberOfPlayers,
            rulesAgreement
        } = req.body;

        if (!teamId || !rulesAgreement) {
            return res.status(400).json({
                success: false,
                message: 'teamId and rulesAgreement are required.'
            });
        }

        // Check tournament
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
            });
        }

        // OPTIONAL: If you're adding this later
        if (tournament.lastDateToRegister < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Registration deadline has passed'
            });
        }

        // Check if team exists and belongs to user
        const team = await Team.findOne({ _id: teamId, createdBy: userId });
        if (!team) {
            return res.status(403).json({
                success: false,
                message: 'Invalid team or unauthorized access'
            });
        }

        // Check if already registered
        const existing = await TeamTournamentRegistration.findOne({
            tournament: tournamentId,
            team: teamId
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'This team has already registered for the tournament'
            });
        }

        // Register
        const registration = new TeamTournamentRegistration({
            tournament: tournamentId,
            team: teamId,
            registeredBy: userId, // ✅ Add this line
            preferredSlot: preferredSlot || '',
            numberOfPlayers: numberOfPlayers || team.players.length || 0,
            rulesAgreement: true
        });


        await registration.save();

        // Optional: push team into tournament.teams[] (only if needed)
        tournament.teams.push(teamId);
        await tournament.save();

        // Notify organizer
        const organizer = await User.findById(tournament.createdBy);
        if (organizer && organizer.fcmToken) {
            await sendPushNotification(
                organizer._id,
                {
                    title: 'New Tournament Registration',
                    body: `${team.teamName} registered for your tournament: ${tournament.tournamentName}`
                },
                {
                    type: 'tournament_registration',
                    tournamentId: tournament._id.toString(),
                    registrationId: registration._id.toString()
                }
            );
        }

        res.status(201).json({
            success: true,
            message: 'Team registered successfully',
            registration
        });

    } catch (error) {
        console.error('Error registering for tournament:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};