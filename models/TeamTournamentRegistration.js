const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const teamTournamentRegistrationSchema = new Schema({
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true
    },
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    registeredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    numberOfPlayers: {
        type: Number,
        default: 0
    },
    preferredSlot: {
        type: String,
        default: ''
    },
    rulesAgreement: {
        type: Boolean,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    registrationDate: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('TeamTournamentRegistration', teamTournamentRegistrationSchema);
