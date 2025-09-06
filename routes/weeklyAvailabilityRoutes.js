const express = require('express');
const router = express.Router();
const {
    generateNextWeekAvailability,
    getWeeklyAvailability,
    updateDayTimeSlot,
    getAvailableGuestSlots
} = require('../controllers/weeklyAvailabilityController');
const { authenticateUser } = require('../middleware/authenticateUser');

// Generate next week's availability (auto-copy from current week)
router.post('/generate-next-week', authenticateUser, generateNextWeekAvailability);

// Get weekly availability for ground owner
router.get('/my-availability', authenticateUser, getWeeklyAvailability);

// Update specific day and time slot availability
router.put('/update-slot', authenticateUser, updateDayTimeSlot);

// Get available guest match slots for a ground (public endpoint for teams)
router.get('/guest-slots', getAvailableGuestSlots);

module.exports = router;