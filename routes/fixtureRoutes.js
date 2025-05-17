const express = require('express');
const router = express.Router();
const { generateFixturePDF } = require('../controllers/fixtureController');

router.get('/generate/:tournamentId', generateFixturePDF);

module.exports = router;
