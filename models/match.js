const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const matchSchema = new Schema({
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    team1: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    team2: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    matchDate: { type: Date, required: true },
    timeSlot: { type: String, required: true }, // e.g., 'morning', 'afternoon', 'evening'
    venue: { type: String, required: true }, // Ground name or ID
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
}, { timestamps: true });

const Match = mongoose.model('Match', matchSchema);
module.exports = Match;