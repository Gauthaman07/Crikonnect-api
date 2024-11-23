const express = require('express');
const router = express.Router();
const { createTeam } = require('../controllers/teamController');
const upload = require('../middleware/upload');

// POST route to create a team
router.post(
    '/create',
    upload.fields([
        { name: 'teamLogo', maxCount: 1 },
        { name: 'groundImage', maxCount: 1 },
    ]),
    createTeam
);

module.exports = router;
