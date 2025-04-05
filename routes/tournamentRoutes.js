const express = require('express');
const router = express.Router();
const { createTournament } = require('../controllers/tournamentController');
const authenticateUser = require('../middleware/authenticateUser');

router.post('/', authenticateUser, createTournament);

module.exports = router;