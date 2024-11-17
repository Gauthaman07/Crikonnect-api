const express = require("express");
const { createTeam } = require("../controllers/teamController");
const upload = require("../middleware/upload"); // Import the multer configuration
const router = express.Router();

// Route to create a new team with file upload
router.post(
    "/create",
    upload.fields([
        { name: "teamLogo", maxCount: 1 }, // Field name should match the frontend input field
        { name: "groundImage", maxCount: 1 }, // Same as above
    ]),
    createTeam
);


module.exports = router;

