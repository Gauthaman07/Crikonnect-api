const express = require('express');
const router = express.Router();
const { createTeam, getTeamByUser } = require('../controllers/teamController');
const upload = require('../middleware/upload');
const authenticateUser = require('../middleware/authenticateUser');

router.post(
    '/create',
    authenticateUser,
    upload.fields([
        { name: 'teamLogo', maxCount: 1 },
        { name: 'groundImage', maxCount: 1 },
    ]),
    createTeam
);

router.get('/user', authenticateUser, getTeamByUser);

module.exports = router;





