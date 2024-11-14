const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const teamSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    logo: {
        type: String,  // URL or file path for the logo
        required: true,
    },
    hasGround: {
        type: Boolean,
        default: false,  // Will indicate if the team has its own ground
    },
    ground: {
        type: Schema.Types.ObjectId,
        ref: 'Ground',
        required: function () { return this.hasGround; },  // Only required if the team has a ground
    },
});

const Team = mongoose.model('Team', teamSchema);
module.exports = Team;
