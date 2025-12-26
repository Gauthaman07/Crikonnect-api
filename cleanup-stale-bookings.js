/**
 * Database Cleanup Script - Remove Stale Booking References
 *
 * This script cleans up stale references in weeklyAvailability documents
 * where bookedMatchId or guestMatchRequests point to non-existent bookings.
 *
 * Usage: node cleanup-stale-bookings.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const WeeklyAvailability = require('./models/weeklyAvailability');
const GuestMatchRequest = require('./models/guestMatchRequest');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sportsBooking';

async function cleanupStaleReferences() {
    try {
        console.log('🔧 Starting database cleanup...\n');

        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all weekly availability documents
        const allAvailabilities = await WeeklyAvailability.find({});
        console.log(`📊 Found ${allAvailabilities.length} weekly availability documents\n`);

        let totalStaleBookedMatchIds = 0;
        let totalStaleRequestIds = 0;
        let totalCleaned = 0;

        for (const availability of allAvailabilities) {
            let hasChanges = false;

            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const slots = ['morning', 'afternoon'];

            for (const day of days) {
                for (const slot of slots) {
                    const slotData = availability.schedule[day][slot];

                    // Check bookedMatchId
                    if (slotData.bookedMatchId) {
                        const booking = await GuestMatchRequest.findById(slotData.bookedMatchId);

                        if (!booking || booking.status !== 'approved') {
                            console.log(`⚠️  Stale bookedMatchId found: ${day} ${slot} - ${slotData.bookedMatchId}`);
                            slotData.bookedMatchId = null;
                            totalStaleBookedMatchIds++;
                            hasChanges = true;
                        }
                    }

                    // Check guestMatchRequests array
                    if (slotData.guestMatchRequests && slotData.guestMatchRequests.length > 0) {
                        const validRequestIds = [];

                        for (const reqId of slotData.guestMatchRequests) {
                            const request = await GuestMatchRequest.findById(reqId);

                            if (request && request.status === 'pending') {
                                validRequestIds.push(reqId);
                            } else {
                                console.log(`⚠️  Stale request ID found: ${day} ${slot} - ${reqId}`);
                                totalStaleRequestIds++;
                                hasChanges = true;
                            }
                        }

                        slotData.guestMatchRequests = validRequestIds;
                    }
                }
            }

            if (hasChanges) {
                await availability.save();
                totalCleaned++;
                console.log(`✅ Cleaned availability document for ground: ${availability.groundId}\n`);
            }
        }

        console.log('\n📈 CLEANUP SUMMARY:');
        console.log(`   - Weekly availability documents checked: ${allAvailabilities.length}`);
        console.log(`   - Documents cleaned: ${totalCleaned}`);
        console.log(`   - Stale bookedMatchId references removed: ${totalStaleBookedMatchIds}`);
        console.log(`   - Stale request IDs removed: ${totalStaleRequestIds}`);
        console.log('\n✅ Cleanup completed successfully!');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the cleanup
cleanupStaleReferences();
