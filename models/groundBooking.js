const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const groundBookingSchema = new Schema({
    groundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ground', required: true },
    bookedByTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    bookedDate: { type: Date, required: true },
    timeSlot: { type: String, enum: ['morning', 'afternoon'], required: true },
    status: { type: String, enum: ['pending', 'booked', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
});

const GroundBooking = mongoose.model('GroundBooking', groundBookingSchema);
module.exports = GroundBooking;
