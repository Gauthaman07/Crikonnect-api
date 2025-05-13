const express = require('express');
const router = express.Router();
const {
  createTournament,
  getTournamentsByLocation,
  registerForTournament,
} = require('../controllers/tournamentController');
const authenticateUser = require('../middleware/authenticateUser');

router.post('/', authenticateUser, createTournament);
router.get('/', authenticateUser, getTournamentsByLocation);

// ✅ Correct dynamic route:
router.post('/tournaments/:tournamentId/registrations', authenticateUser, registerForTournament);

module.exports = router;
