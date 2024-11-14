const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const groundSchema = new Schema({
    description: {
        type: String,
        required: true,
    },
    image: {
        type: String,  // URL or file path for the image
        required: true,
    },
    facilities: {
        type: [String],  // Array of facilities (e.g., Parking, Changing Rooms)
        required: true,
    },
    groundFee: {
        type: Number,
        required: true,
    },
});

const Ground = mongoose.model('Ground', groundSchema);
module.exports = Ground;
