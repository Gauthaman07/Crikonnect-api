const WeeklyAvailability = require('../models/weeklyAvailability');
const GuestMatchRequest = require('../models/guestMatchRequest');
const Team = require('../models/team');
const Ground = require('../models/ground');
const User = require('../models/User');
const { sendPushNotification } = require('../services/notificationService');

// Helper function to get Monday of the week
const getMondayOfWeek = (date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

// Helper function to get Sunday of the week
const getSundayOfWeek = (date) => {
    const monday = getMondayOfWeek(new Date(date));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
};

// Helper function to create default weekly schedule
const createDefaultSchedule = () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const schedule = {};
    
    days.forEach(day => {
        schedule[day] = {
            morning: { mode: 'unavailable', guestMatchRequest: null },
            afternoon: { mode: 'unavailable', guestMatchRequest: null }
        };
    });
    
    return schedule;
};

// Auto-generate next week's availability (copying from previous week)
exports.generateNextWeekAvailability = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Find user's team that owns a ground
        const ownerTeam = await Team.findOne({ 
            createdBy: userId, 
            hasOwnGround: true 
        }).populate('groundId');
        
        if (!ownerTeam || !ownerTeam.groundId) {
            return res.status(404).json({ 
                message: 'No ground found for this user.' 
            });
        }
        
        // Get current week's Monday
        const currentMonday = getMondayOfWeek(new Date());
        const nextMonday = new Date(currentMonday);
        nextMonday.setDate(currentMonday.getDate() + 7);
        const nextSunday = getSundayOfWeek(nextMonday);
        
        // Check if next week already exists
        const existingNextWeek = await WeeklyAvailability.findOne({
            groundId: ownerTeam.groundId._id,
            weekStartDate: nextMonday
        });
        
        if (existingNextWeek) {
            return res.status(400).json({ 
                message: 'Next week availability already exists.' 
            });
        }
        
        // Find current week's availability
        const currentWeek = await WeeklyAvailability.findOne({
            groundId: ownerTeam.groundId._id,
            weekStartDate: currentMonday
        });
        
        let scheduleTemplate = createDefaultSchedule();
        
        if (currentWeek) {
            // Copy current week's schedule as template (without guest match requests)
            scheduleTemplate = JSON.parse(JSON.stringify(currentWeek.schedule));
            
            // Clear guest match requests for the new week
            Object.keys(scheduleTemplate).forEach(day => {
                scheduleTemplate[day].morning.guestMatchRequest = null;
                scheduleTemplate[day].afternoon.guestMatchRequest = null;
            });
        }
        
        // Create next week's availability
        const nextWeekAvailability = new WeeklyAvailability({
            groundId: ownerTeam.groundId._id,
            ownerTeamId: ownerTeam._id,
            weekStartDate: nextMonday,
            weekEndDate: nextSunday,
            schedule: scheduleTemplate
        });
        
        await nextWeekAvailability.save();
        
        res.status(201).json({
            success: true,
            message: 'Next week availability generated successfully.',
            availability: nextWeekAvailability
        });
        
    } catch (error) {
        console.error('Error generating next week availability:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get weekly availability for ground owner
exports.getWeeklyAvailability = async (req, res) => {
    try {
        const userId = req.user.id;
        const { weekStartDate } = req.query;
        
        // Find user's team that owns a ground
        const ownerTeam = await Team.findOne({ 
            createdBy: userId, 
            hasOwnGround: true 
        }).populate('groundId');
        
        if (!ownerTeam || !ownerTeam.groundId) {
            return res.status(404).json({ 
                message: 'No ground found for this user.' 
            });
        }
        
        let monday;
        if (weekStartDate) {
            monday = getMondayOfWeek(new Date(weekStartDate));
        } else {
            monday = getMondayOfWeek(new Date());
        }
        
        // Find or create weekly availability
        let weeklyAvailability = await WeeklyAvailability.findOne({
            groundId: ownerTeam.groundId._id,
            weekStartDate: monday
        }).populate({
            path: 'schedule.monday.morning.guestMatchRequest schedule.monday.afternoon.guestMatchRequest schedule.tuesday.morning.guestMatchRequest schedule.tuesday.afternoon.guestMatchRequest schedule.wednesday.morning.guestMatchRequest schedule.wednesday.afternoon.guestMatchRequest schedule.thursday.morning.guestMatchRequest schedule.thursday.afternoon.guestMatchRequest schedule.friday.morning.guestMatchRequest schedule.friday.afternoon.guestMatchRequest schedule.saturday.morning.guestMatchRequest schedule.saturday.afternoon.guestMatchRequest schedule.sunday.morning.guestMatchRequest schedule.sunday.afternoon.guestMatchRequest',
            populate: {
                path: 'teamA teamB requestedBy',
                select: 'teamName teamLogo name email'
            }
        });
        
        if (!weeklyAvailability) {
            // Create new weekly availability with default schedule
            const sunday = getSundayOfWeek(monday);
            weeklyAvailability = new WeeklyAvailability({
                groundId: ownerTeam.groundId._id,
                ownerTeamId: ownerTeam._id,
                weekStartDate: monday,
                weekEndDate: sunday,
                schedule: createDefaultSchedule()
            });
            await weeklyAvailability.save();
        }
        
        res.status(200).json({
            success: true,
            message: 'Weekly availability retrieved successfully.',
            availability: weeklyAvailability,
            groundInfo: {
                groundName: ownerTeam.groundId.groundName,
                location: ownerTeam.groundId.location
            }
        });
        
    } catch (error) {
        console.error('Error getting weekly availability:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Update availability for specific day and time slot
exports.updateDayTimeSlot = async (req, res) => {
    try {
        const userId = req.user.id;
        const { weekStartDate, day, timeSlot, mode } = req.body;
        
        if (!['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(day)) {
            return res.status(400).json({ message: 'Invalid day specified.' });
        }
        
        if (!['morning', 'afternoon'].includes(timeSlot)) {
            return res.status(400).json({ message: 'Invalid time slot specified.' });
        }
        
        if (!['owner_play', 'guest_match', 'unavailable'].includes(mode)) {
            return res.status(400).json({ message: 'Invalid mode specified.' });
        }
        
        // Find user's team that owns a ground
        const ownerTeam = await Team.findOne({ 
            createdBy: userId, 
            hasOwnGround: true 
        });
        
        if (!ownerTeam) {
            return res.status(404).json({ 
                message: 'No ground found for this user.' 
            });
        }
        
        const monday = getMondayOfWeek(new Date(weekStartDate));
        
        // Find weekly availability
        const weeklyAvailability = await WeeklyAvailability.findOne({
            groundId: ownerTeam.groundId,
            weekStartDate: monday
        });
        
        if (!weeklyAvailability) {
            return res.status(404).json({ 
                message: 'Weekly availability not found.' 
            });
        }
        
        // Check if there's an existing guest match request that needs to be handled
        const currentSlot = weeklyAvailability.schedule[day][timeSlot];
        if (currentSlot.guestMatchRequest && mode !== 'guest_match') {
            // If changing away from guest_match mode, cancel any pending request
            const guestRequest = await GuestMatchRequest.findById(currentSlot.guestMatchRequest);
            if (guestRequest && guestRequest.status === 'pending') {
                guestRequest.status = 'cancelled';
                await guestRequest.save();
            }
        }
        
        // Update the specific day and time slot
        weeklyAvailability.schedule[day][timeSlot] = {
            mode: mode,
            guestMatchRequest: mode === 'guest_match' ? currentSlot.guestMatchRequest : null
        };
        
        weeklyAvailability.updatedAt = Date.now();
        await weeklyAvailability.save();
        
        res.status(200).json({
            success: true,
            message: 'Availability updated successfully.',
            updatedSlot: {
                day,
                timeSlot,
                mode,
                weekStartDate: monday
            }
        });
        
    } catch (error) {
        console.error('Error updating day time slot:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get available slots for guest teams to request
exports.getAvailableGuestSlots = async (req, res) => {
    try {
        const { groundId, weekStartDate } = req.query;
        
        if (!groundId) {
            return res.status(400).json({ message: 'Ground ID is required.' });
        }
        
        const monday = weekStartDate ? getMondayOfWeek(new Date(weekStartDate)) : getMondayOfWeek(new Date());
        
        // Find weekly availability
        const weeklyAvailability = await WeeklyAvailability.findOne({
            groundId: groundId,
            weekStartDate: monday
        });
        
        if (!weeklyAvailability) {
            return res.status(404).json({ 
                message: 'No availability found for this ground and week.' 
            });
        }
        
        // Extract available guest match slots
        const availableSlots = [];
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        days.forEach(day => {
            ['morning', 'afternoon'].forEach(timeSlot => {
                const slot = weeklyAvailability.schedule[day][timeSlot];
                if (slot.mode === 'guest_match' && !slot.guestMatchRequest) {
                    availableSlots.push({
                        day,
                        timeSlot,
                        date: new Date(monday.getTime() + (days.indexOf(day) * 24 * 60 * 60 * 1000))
                    });
                }
            });
        });
        
        res.status(200).json({
            success: true,
            message: 'Available guest slots retrieved successfully.',
            availableSlots,
            weekStartDate: monday,
            weekEndDate: getSundayOfWeek(monday)
        });
        
    } catch (error) {
        console.error('Error getting available guest slots:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    generateNextWeekAvailability: exports.generateNextWeekAvailability,
    getWeeklyAvailability: exports.getWeeklyAvailability,
    updateDayTimeSlot: exports.updateDayTimeSlot,
    getAvailableGuestSlots: exports.getAvailableGuestSlots
};