const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tournamentSchema = new Schema({
    tournamentName: { type: String, required: true },
    tournamentType: { type: String, required: true },
    location: { type: String, required: true },
    groundName: { type: String, default: null },
    organizerName: { type: String, required: true },
    contactDetails: {
        phone: { type: String, default: null },
        email: { type: String, default: null }
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    matchDaysPreference: { type: String, required: true },
    sessionsAvailable: { type: [String], required: true },
    numberOfTeams: { type: Number, required: true },
    oversPerMatch: { type: Number, required: true },
    ballType: { type: String, required: true },
    entryFee: { type: Number, required: true },
    winningPrize: { type: String, default: null },
    playerEligibility: { type: String, default: null },
    teamComposition: { type: Number, required: true },
    rulesDocument: { type: String, default: null }, // URL or path to the document
    umpireProvided: { type: Boolean, default: false },
    lastDateToRegister: { type: Date, required: true },
    autoFixtureGeneration: { type: Boolean, default: false },
    fixturePDFUrl: { type: String, default: null },             // ✅ NEW
    autoFixtureGenerated: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }]
}, { timestamps: true });

const Tournament = mongoose.model('Tournament', tournamentSchema);
module.exports = Tournament;