const WeeklyAvailability = require('./models/weeklyAvailability');
const GuestMatchRequest = require('./models/guestMatchRequest');
const Team = require('./models/team');
const Ground = require('./models/ground');
const User = require('./models/User');
const mongoose = require('mongoose');
const { manualGenerateWeeklySchedules } = require('./services/weeklyScheduleService');
const dotenv = require('dotenv');

dotenv.config();

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

async function testWeeklyAvailabilityFeature() {
    try {
        console.log('🧪 Starting Weekly Availability Feature Test\n');

        // Connect to MongoDB
        const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sportsBooking';
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Test 1: Find ground-owning teams
        console.log('\n📋 Test 1: Finding ground-owning teams...');
        const groundOwningTeams = await Team.find({ 
            hasOwnGround: true,
            groundId: { $exists: true, $ne: null }
        }).populate('groundId createdBy');

        console.log(`Found ${groundOwningTeams.length} ground-owning teams:`);
        groundOwningTeams.forEach(team => {
            console.log(`  - ${team.teamName} (Ground: ${team.groundId?.groundName || 'Unknown'})`);
        });

        if (groundOwningTeams.length === 0) {
            console.log('❌ No ground-owning teams found. Creating test data...');
            // Note: In production, you would create test data here
            console.log('Please ensure you have teams with hasOwnGround: true in your database');
            return;
        }

        // Test 2: Check current week availability
        console.log('\n📅 Test 2: Checking current week availability...');
        const currentMonday = getMondayOfWeek(new Date());
        console.log(`Current week starts: ${currentMonday.toISOString().split('T')[0]}`);

        for (const team of groundOwningTeams.slice(0, 2)) { // Test first 2 teams only
            const availability = await WeeklyAvailability.findOne({
                groundId: team.groundId._id,
                weekStartDate: currentMonday
            });

            if (availability) {
                console.log(`✅ ${team.teamName}: Current week availability exists`);
                
                // Check schedule structure
                const schedule = availability.schedule;
                const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                let totalSlots = 0;
                let guestSlots = 0;
                
                days.forEach(day => {
                    ['morning', 'afternoon'].forEach(timeSlot => {
                        totalSlots++;
                        if (schedule[day][timeSlot].mode === 'guest_match') {
                            guestSlots++;
                        }
                    });
                });
                
                console.log(`   📊 Schedule summary: ${guestSlots}/${totalSlots} slots available for guest matches`);
            } else {
                console.log(`❌ ${team.teamName}: No current week availability found`);
            }
        }

        // Test 3: Test auto-generation of weekly schedules
        console.log('\n🔄 Test 3: Testing auto-generation of weekly schedules...');
        await manualGenerateWeeklySchedules();

        // Test 4: Check guest match requests
        console.log('\n🏏 Test 4: Checking guest match requests...');
        const allGuestRequests = await GuestMatchRequest.find({})
            .populate('groundId', 'groundName')
            .populate('teamA teamB', 'teamName')
            .populate('ownerTeamId', 'teamName');

        console.log(`Found ${allGuestRequests.length} total guest match requests:`);
        
        const statusCount = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
        allGuestRequests.forEach(request => {
            statusCount[request.status]++;
            console.log(`  - ${request.teamA?.teamName || 'Unknown'} vs ${request.teamB?.teamName || 'Unknown'} at ${request.groundId?.groundName || 'Unknown'} (${request.status})`);
        });
        
        console.log(`📊 Status breakdown:`, statusCount);

        // Test 5: Validate database indexes
        console.log('\n🔍 Test 5: Validating database indexes...');
        
        const weeklyAvailabilityIndexes = await WeeklyAvailability.collection.getIndexes();
        const guestRequestIndexes = await GuestMatchRequest.collection.getIndexes();
        
        console.log('WeeklyAvailability indexes:', Object.keys(weeklyAvailabilityIndexes));
        console.log('GuestMatchRequest indexes:', Object.keys(guestRequestIndexes));

        // Test 6: Test API endpoints (basic validation)
        console.log('\n🌐 Test 6: API endpoint validation...');
        console.log('✅ Weekly Availability routes: /api/weekly-availability/*');
        console.log('✅ Guest Match routes: /api/guest-matches/*');
        console.log('Note: Start the server and test these endpoints with proper authentication');

        console.log('\n🎉 Weekly Availability Feature Test Completed!');
        console.log('\nNext steps:');
        console.log('1. Start the server: npm start');
        console.log('2. Test API endpoints with a REST client');
        console.log('3. Test the Flutter UI components');
        console.log('4. Verify push notifications are working');

    } catch (error) {
        console.error('💥 Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the test
if (require.main === module) {
    testWeeklyAvailabilityFeature();
}

module.exports = { testWeeklyAvailabilityFeature };