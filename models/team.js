const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const teamSchema = new Schema({
    teamName: { type: String, required: true },
    teamLogo: { type: String, required: true },
    location: { type: String, required: true },
    hasOwnGround: { type: Boolean, required: true },
    groundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ground', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const Team = mongoose.model('Team', teamSchema);
module.exports = Team;


