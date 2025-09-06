const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const weeklyAvailabilitySchema = new Schema({
    groundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ground', required: true },
    ownerTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    weekStartDate: { type: Date, required: true }, // Monday of the week
    weekEndDate: { type: Date, required: true },   // Sunday of the week
    
    // Weekly schedule - 7 days, 2 slots each
    schedule: {
        monday: {
            morning: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            },
            afternoon: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            }
        },
        tuesday: {
            morning: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            },
            afternoon: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            }
        },
        wednesday: {
            morning: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            },
            afternoon: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            }
        },
        thursday: {
            morning: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            },
            afternoon: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            }
        },
        friday: {
            morning: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            },
            afternoon: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            }
        },
        saturday: {
            morning: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            },
            afternoon: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            }
        },
        sunday: {
            morning: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            },
            afternoon: {
                mode: { type: String, enum: ['owner_play', 'guest_match', 'unavailable'], default: 'unavailable' },
                guestMatchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestMatchRequest', default: null }
            }
        }
    },
    
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Index for efficient queries
weeklyAvailabilitySchema.index({ groundId: 1, weekStartDate: 1 });
weeklyAvailabilitySchema.index({ ownerTeamId: 1, weekStartDate: 1 });

const WeeklyAvailability = mongoose.model('WeeklyAvailability', weeklyAvailabilitySchema);
module.exports = WeeklyAvailability;