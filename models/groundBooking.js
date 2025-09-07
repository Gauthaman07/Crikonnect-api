const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const groundBookingSchema = new Schema({
    groundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ground', required: true },
    bookedByTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    bookedDate: { type: Date, required: true },
    timeSlot: { type: String, enum: ['morning', 'afternoon'], required: true },
    status: { type: String, enum: ['pending', 'booked', 'rejected'], default: 'pending' },
    
    // NEW FIELD: Opponent team for different match types
    // null = vs ground owner team (owner_play mode)
    // ObjectId = vs another guest team (host_only mode)
    opponentTeam: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Team',
        default: null 
    },
    
    // Additional fields for better tracking
    weeklyAvailabilityRef: { type: mongoose.Schema.Types.ObjectId, ref: 'WeeklyAvailability' },
    availabilityMode: { type: String, enum: ['regular', 'owner_play', 'host_only'] },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const GroundBooking = mongoose.model('GroundBooking', groundBookingSchema);
module.exports = GroundBooking;
