const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const groundSchema = new Schema({
    groundName: { type: String, required: true },
    description: { type: String, required: true },
    groundMaplink: { type: String, required: true },
    image: { type: String, required: true },
    facilities: { type: [String], required: true },
    location: { type: String, required: true },
    fee: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ownedByTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
});

const Ground = mongoose.model('Ground', groundSchema);
module.exports = Ground;
