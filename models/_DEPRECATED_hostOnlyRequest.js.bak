const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const hostOnlyRequestSchema = new Schema({
    groundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ground', required: true },
    ownerTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    
    // Match details
    requestedDate: { type: Date, required: true },
    timeSlot: { type: String, enum: ['morning', 'afternoon'], required: true },
    
    // Teams requesting (both need to be approved)
    teamA: { 
        teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        requestedAt: { type: Date, default: Date.now }
    },
    teamB: { 
        teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        requestedAt: { type: Date, default: Date.now }
    },
    
    // Overall session status
    sessionStatus: { 
        type: String, 
        enum: ['waiting_for_teams', 'one_team_approved', 'both_teams_approved', 'session_locked', 'cancelled'], 
        default: 'waiting_for_teams' 
    },
    
    // Match details
    matchDescription: { type: String, maxlength: 500 },
    matchFee: { type: Number, default: 0 },
    
    // Weekly availability reference
    weeklyAvailabilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'WeeklyAvailability', required: true },
    
    // Response from ground owner
    ownerResponse: {
        responseDate: { type: Date },
        responseNote: { type: String, maxlength: 300 },
        respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes
hostOnlyRequestSchema.index({ groundId: 1, requestedDate: 1 });
hostOnlyRequestSchema.index({ ownerTeamId: 1, sessionStatus: 1 });
hostOnlyRequestSchema.index({ 'teamA.teamId': 1 });
hostOnlyRequestSchema.index({ 'teamB.teamId': 1 });

// Update timestamp on save
hostOnlyRequestSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const HostOnlyRequest = mongoose.model('HostOnlyRequest', hostOnlyRequestSchema);
module.exports = HostOnlyRequest;