const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const guestMatchRequestSchema = new Schema({
    groundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ground', required: true },
    ownerTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    
    // Match details
    requestedDate: { type: Date, required: true },
    timeSlot: { type: String, enum: ['morning', 'afternoon'], required: true },
    
    // Teams involved
    teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true }, // Requesting team
    teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }, // Opponent team (null for owner_play mode)
    
    // Match type based on availability mode
    matchType: { type: String, enum: ['vs_owner', 'guest_vs_guest'], required: true },
    
    // Request details
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // User who made the request
    matchCategory: { type: String, default: 'friendly' }, // friendly, tournament, league
    matchDescription: { type: String, maxlength: 500 },
    
    // Approval status
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected', 'cancelled'], 
        default: 'pending' 
    },
    
    // Response details
    responseDate: { type: Date },
    responseNote: { type: String, maxlength: 300 },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Weekly availability reference
    weeklyAvailabilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'WeeklyAvailability', required: true },
    
    // Match fee (if applicable)
    matchFee: { type: Number, default: 0 },
    feeStatus: { type: String, enum: ['pending', 'paid', 'waived'], default: 'pending' },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes
guestMatchRequestSchema.index({ groundId: 1, requestedDate: 1 });
guestMatchRequestSchema.index({ teamA: 1, status: 1 });
guestMatchRequestSchema.index({ teamB: 1, status: 1 });
guestMatchRequestSchema.index({ ownerTeamId: 1, status: 1 });
guestMatchRequestSchema.index({ requestedBy: 1 });

// Update timestamp on save
guestMatchRequestSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const GuestMatchRequest = mongoose.model('GuestMatchRequest', guestMatchRequestSchema);
module.exports = GuestMatchRequest;