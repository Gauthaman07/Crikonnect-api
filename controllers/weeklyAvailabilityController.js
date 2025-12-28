const WeeklyAvailability = require('../models/weeklyAvailability');
const GuestMatchRequest = require('../models/guestMatchRequest');
const Team = require('../models/team');
const Ground = require('../models/ground');
const User = require('../models/User');
const { sendPushNotification } = require('../services/notificationService');

// Helper function to get Monday of the week
const getMondayOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
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
            morning: { mode: 'unavailable', guestMatchRequests: [], bookedMatchId: null },
            afternoon: { mode: 'unavailable', guestMatchRequests: [], bookedMatchId: null }
        };
    });
    
    return schedule;
};

// Auto-generate availability for the next 3 weeks (copying from previous week)
const generateNextWeekAvailability = async (req, res) => {
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
        
        // We will generate for next 3 weeks
        const weeksToGenerate = 3;
        const results = [];

        // Find current week's availability (as template)
        const currentWeek = await WeeklyAvailability.findOne({
            groundId: ownerTeam.groundId._id,
            weekStartDate: currentMonday
        });
        
        let scheduleTemplate = createDefaultSchedule();
        
        if (currentWeek) {
            // Copy current week's schedule as template
            scheduleTemplate = JSON.parse(JSON.stringify(currentWeek.schedule));
            
            // Clear booking info for the new week
            Object.keys(scheduleTemplate).forEach(day => {
                scheduleTemplate[day].morning.guestMatchRequests = [];
                scheduleTemplate[day].morning.bookedMatchId = null;
                scheduleTemplate[day].afternoon.guestMatchRequests = [];
                scheduleTemplate[day].afternoon.bookedMatchId = null;
            });
        }

        // Loop to generate future weeks
        for (let i = 1; i <= weeksToGenerate; i++) {
            const nextMonday = new Date(currentMonday);
            nextMonday.setDate(currentMonday.getDate() + (7 * i));
            const nextSunday = getSundayOfWeek(nextMonday);
            
            // Check if this week already exists
            const existingWeek = await WeeklyAvailability.findOne({
                groundId: ownerTeam.groundId._id,
                weekStartDate: nextMonday
            });
            
            if (!existingWeek) {
                // Create new weekly availability
                const newWeekAvailability = new WeeklyAvailability({
                    groundId: ownerTeam.groundId._id,
                    ownerTeamId: ownerTeam._id,
                    weekStartDate: nextMonday,
                    weekEndDate: nextSunday,
                    schedule: scheduleTemplate
                });
                
                await newWeekAvailability.save();
                results.push({ week: i, startDate: nextMonday, status: 'created' });
            } else {
                results.push({ week: i, startDate: nextMonday, status: 'exists' });
            }
        }
        
        res.status(201).json({
            success: true,
            message: 'Future availability checks completed.',
            details: results
        });
        
    } catch (error) {
        console.error('Error generating future availability:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Helper function to ensure next 3 weeks exist
const ensureThreeWeeksExist = async (groundId, ownerTeamId) => {
    const today = new Date();
    const currentMonday = getMondayOfWeek(today);

    // Get or create template from current week
    const currentWeek = await WeeklyAvailability.findOne({
        groundId: groundId,
        weekStartDate: currentMonday
    });

    let scheduleTemplate = createDefaultSchedule();

    if (currentWeek) {
        // Copy current week's schedule as template (without bookings)
        scheduleTemplate = JSON.parse(JSON.stringify(currentWeek.schedule));
        Object.keys(scheduleTemplate).forEach(day => {
            scheduleTemplate[day].morning.guestMatchRequests = [];
            scheduleTemplate[day].morning.bookedMatchId = null;
            scheduleTemplate[day].afternoon.guestMatchRequests = [];
            scheduleTemplate[day].afternoon.bookedMatchId = null;
        });
    }

    // Ensure next 3 weeks exist (including current week)
    for (let i = 0; i < 3; i++) {
        const nextMonday = new Date(currentMonday);
        nextMonday.setDate(currentMonday.getDate() + (7 * i));
        const nextSunday = getSundayOfWeek(nextMonday);

        const exists = await WeeklyAvailability.findOne({
            groundId: groundId,
            weekStartDate: nextMonday
        });

        if (!exists) {
            const newWeekAvailability = new WeeklyAvailability({
                groundId: groundId,
                ownerTeamId: ownerTeamId,
                weekStartDate: nextMonday,
                weekEndDate: nextSunday,
                schedule: scheduleTemplate
            });
            await newWeekAvailability.save();
            console.log(`✅ Created availability for week starting: ${nextMonday.toDateString()}`);
        }
    }
};

// Get weekly availability for ground owner
const getWeeklyAvailability = async (req, res) => {
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

        // Ensure next 3 weeks exist before fetching
        await ensureThreeWeeksExist(ownerTeam.groundId._id, ownerTeam._id);

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
            path: 'schedule.monday.morning.guestMatchRequests schedule.monday.afternoon.guestMatchRequests schedule.tuesday.morning.guestMatchRequests schedule.tuesday.afternoon.guestMatchRequests schedule.wednesday.morning.guestMatchRequests schedule.wednesday.afternoon.guestMatchRequests schedule.thursday.morning.guestMatchRequests schedule.thursday.afternoon.guestMatchRequests schedule.friday.morning.guestMatchRequests schedule.friday.afternoon.guestMatchRequests schedule.saturday.morning.guestMatchRequests schedule.saturday.afternoon.guestMatchRequests schedule.sunday.morning.guestMatchRequests schedule.sunday.afternoon.guestMatchRequests',
            populate: {
                path: 'teamA teamB requestedBy',
                select: 'teamName teamLogo name email'
            }
        }).populate({
            path: 'schedule.monday.morning.bookedMatchId schedule.monday.afternoon.bookedMatchId schedule.tuesday.morning.bookedMatchId schedule.tuesday.afternoon.bookedMatchId schedule.wednesday.morning.bookedMatchId schedule.wednesday.afternoon.bookedMatchId schedule.thursday.morning.bookedMatchId schedule.thursday.afternoon.bookedMatchId schedule.friday.morning.bookedMatchId schedule.friday.afternoon.bookedMatchId schedule.saturday.morning.bookedMatchId schedule.saturday.afternoon.bookedMatchId schedule.sunday.morning.bookedMatchId schedule.sunday.afternoon.bookedMatchId',
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
const updateDayTimeSlot = async (req, res) => {
    try {
        const userId = req.user.id;
        const { weekStartDate, day, timeSlot, mode } = req.body;

        if (!['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(day)) {
            return res.status(400).json({ message: 'Invalid day specified.' });
        }

        if (!['morning', 'afternoon'].includes(timeSlot)) {
            return res.status(400).json({ message: 'Invalid time slot specified.' });
        }

        if (!['owner_play', 'host_only', 'unavailable'].includes(mode)) {
            return res.status(400).json({ message: 'Invalid mode specified.' });
        }

        // Calculate the actual date being modified
        const monday = getMondayOfWeek(new Date(weekStartDate));
        const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(day);
        const targetDate = new Date(monday);
        targetDate.setDate(monday.getDate() + dayIndex);
        targetDate.setHours(0, 0, 0, 0);

        // Block changes 1 day before (must modify at least 2 days in advance)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        if (targetDate <= tomorrow) {
            return res.status(403).json({
                success: false,
                message: `Cannot change availability for ${day}. Changes must be made at least 1 day in advance (by ${tomorrow.toDateString()}).`
            });
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
        
        const currentSlot = weeklyAvailability.schedule[day][timeSlot];

        // If changing to 'unavailable', we should probably reject pending requests or at least warn
        // For now, we will just keep the data but the slot becomes unavailable for new bookings
        
        // Update the specific day and time slot
        // Preserve existing requests and bookings if just switching between active modes
        const preserveData = ['owner_play', 'host_only'].includes(mode) && ['owner_play', 'host_only'].includes(currentSlot.mode);

        weeklyAvailability.schedule[day][timeSlot] = {
            mode: mode,
            guestMatchRequests: preserveData ? currentSlot.guestMatchRequests : [],
            bookedMatchId: preserveData ? currentSlot.bookedMatchId : null
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
const getAvailableGuestSlots = async (req, res) => {
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
                
                // Show slot if it is in a playable mode AND NOT BOOKED
                // Pending requests do not hide the slot anymore (allowing multiple requests)
                if (['owner_play', 'host_only'].includes(slot.mode) && !slot.bookedMatchId) {
                    availableSlots.push({
                        day,
                        timeSlot,
                        mode: slot.mode,
                        date: new Date(monday.getTime() + (days.indexOf(day) * 24 * 60 * 60 * 1000)),
                        requestCount: slot.guestMatchRequests ? slot.guestMatchRequests.length : 0
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
    generateNextWeekAvailability,
    getWeeklyAvailability,
    updateDayTimeSlot,
    getAvailableGuestSlots
};