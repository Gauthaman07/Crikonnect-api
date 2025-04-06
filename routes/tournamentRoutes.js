const express = require('express');
const router = express.Router();
const { createTournament, getTournamentsByLocation } = require('../controllers/tournamentController');
const authenticateUser = require('../middleware/authenticateUser');

// Existing POST route for creating tournaments
router.post('/', authenticateUser, createTournament);

// New GET route for retrieving tournaments by location
router.get('/', getTournamentsByLocation);

module.exports = router;