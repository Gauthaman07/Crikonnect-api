const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    teamName: { type: String, required: true },
    teamLogo: { type: String, required: true },
    hasOwnGround: { type: Boolean, required: true },
    groundDescription: { type: String },
    groundImage: { type: String },
    facilities: [{ type: String }],
    groundFee: { type: Number },
});

module.exports = mongoose.model('Team', teamSchema);
