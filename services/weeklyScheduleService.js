const cron = require('node-cron');
const WeeklyAvailability = require('../models/weeklyAvailability');
const Team = require('../models/team');

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

// Auto-generate next week availability for all ground-owning teams
const autoGenerateWeeklySchedules = async () => {
    try {
        console.log('🕐 Starting auto-generation of weekly schedules...');
        
        // Find all teams that own grounds
        const groundOwningTeams = await Team.find({ 
            hasOwnGround: true,
            groundId: { $exists: true, $ne: null }
        }).populate('groundId');
        
        console.log(`📋 Found ${groundOwningTeams.length} ground-owning teams`);
        
        const nextMonday = getMondayOfWeek(new Date());
        nextMonday.setDate(nextMonday.getDate() + 7); // Next week's Monday
        const nextSunday = getSundayOfWeek(nextMonday);
        
        let generatedCount = 0;
        let skippedCount = 0;
        
        for (const team of groundOwningTeams) {
            try {
                // Check if next week already exists
                const existingNextWeek = await WeeklyAvailability.findOne({
                    groundId: team.groundId._id,
                    weekStartDate: nextMonday
                });
                
                if (existingNextWeek) {
                    console.log(`⏭️ Skipping ${team.teamName} - next week already exists`);
                    skippedCount++;
                    continue;
                }
                
                // Get current week's availability
                const currentMonday = getMondayOfWeek(new Date());
                const currentWeek = await WeeklyAvailability.findOne({
                    groundId: team.groundId._id,
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
                    
                    console.log(`📅 Copying schedule from current week for ${team.teamName}`);
                } else {
                    console.log(`🆕 Creating default schedule for ${team.teamName}`);
                }
                
                // Create next week's availability
                const nextWeekAvailability = new WeeklyAvailability({
                    groundId: team.groundId._id,
                    ownerTeamId: team._id,
                    weekStartDate: nextMonday,
                    weekEndDate: nextSunday,
                    schedule: scheduleTemplate
                });
                
                await nextWeekAvailability.save();
                generatedCount++;
                
                console.log(`✅ Generated weekly schedule for ${team.teamName} (${team.groundId.groundName})`);
                
            } catch (teamError) {
                console.error(`❌ Error generating schedule for team ${team.teamName}:`, teamError);
            }
        }
        
        console.log(`🎉 Weekly schedule auto-generation completed!`);
        console.log(`   ✅ Generated: ${generatedCount} schedules`);
        console.log(`   ⏭️ Skipped: ${skippedCount} schedules (already existed)`);
        
    } catch (error) {
        console.error('💥 Error in auto-generating weekly schedules:', error);
    }
};

// Schedule the cron job to run every Sunday at 11:00 PM
// This ensures new week schedules are ready by Monday morning
const startWeeklyScheduleCron = () => {
    // Run every Sunday at 11:00 PM (0 23 * * 0)
    cron.schedule('0 23 * * 0', () => {
        console.log('⏰ Sunday night cron job triggered - generating next week schedules');
        autoGenerateWeeklySchedules();
    }, {
        timezone: "Asia/Kolkata" // Adjust timezone as needed
    });
    
    console.log('⏰ Weekly schedule cron job started - will run every Sunday at 11:00 PM IST');
};

// Manual trigger function for testing
const manualGenerateWeeklySchedules = () => {
    console.log('🔧 Manual trigger for weekly schedule generation');
    return autoGenerateWeeklySchedules();
};

module.exports = {
    startWeeklyScheduleCron,
    manualGenerateWeeklySchedules,
    autoGenerateWeeklySchedules
};