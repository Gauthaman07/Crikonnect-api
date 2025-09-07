const mongoose = require('mongoose');
const GroundBooking = require('./models/groundBooking');
const WeeklyAvailability = require('./models/weeklyAvailability');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crikonnect', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Helper function to get Monday of the week
const getMondayOfWeek = (date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

async function fixBookingModes() {
    try {
        console.log('🔧 Fixing booking availability modes...');
        
        // Find all bookings with regular mode that have weekly availability refs
        const bookingsToFix = await GroundBooking.find({
            availabilityMode: 'regular',
            weeklyAvailabilityRef: { $exists: true, $ne: null }
        });
        
        console.log(`📊 Found ${bookingsToFix.length} bookings to potentially fix`);
        
        for (const booking of bookingsToFix) {
            // Get the weekly availability for this booking
            const weeklyAvailability = await WeeklyAvailability.findById(booking.weeklyAvailabilityRef);
            
            if (weeklyAvailability) {
                const requestedDate = new Date(booking.bookedDate);
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const dayName = dayNames[requestedDate.getDay()];
                const slot = weeklyAvailability.schedule[dayName][booking.timeSlot];
                
                if (slot && slot.mode !== 'unavailable') {
                    console.log(`📝 Updating booking ${booking._id}:`);
                    console.log(`   Date: ${booking.bookedDate}`);
                    console.log(`   Time: ${booking.timeSlot}`);
                    console.log(`   From: ${booking.availabilityMode} -> ${slot.mode}`);
                    
                    await GroundBooking.findByIdAndUpdate(booking._id, {
                        availabilityMode: slot.mode
                    });
                }
            }
        }
        
        console.log('✅ Booking modes updated successfully!');
        
        // Now handle the specific case: Sunday afternoon host_only mode
        console.log('\n🎯 Checking Sunday September 14 afternoon bookings...');
        
        const sep14Afternoon = await GroundBooking.find({
            bookedDate: new Date('2025-09-14'),
            timeSlot: 'afternoon',
            availabilityMode: { $in: ['host_only', 'regular'] }
        });
        
        console.log(`📊 Found ${sep14Afternoon.length} bookings for Sep 14 afternoon`);
        
        if (sep14Afternoon.length >= 1) {
            console.log('⚠️ Note: For host_only mode, you need to:');
            console.log('1. Have Team B book with Team C as opponent');
            console.log('2. Have Team C book with Team B as opponent');
            console.log('3. Both bookings should reference each other as opponentTeam');
            console.log('\n Current bookings:');
            sep14Afternoon.forEach((booking, index) => {
                console.log(`   ${index + 1}. Team: ${booking.bookedByTeam}, Opponent: ${booking.opponentTeam || 'null'}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error fixing booking modes:', error);
    } finally {
        mongoose.connection.close();
    }
}

fixBookingModes();