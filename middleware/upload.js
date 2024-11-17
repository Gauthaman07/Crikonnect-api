const multer = require("multer");
const path = require("path");

// Configure multer for file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/"); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    },
});

// File filter for image types
const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only images are allowed"), false);
    }
};

// Multer instance for handling multiple files
const upload = multer({
    storage,
    fileFilter,
}).fields([ // Define the expected fields here
    { name: "teamLogo", maxCount: 1 },
    { name: "groundImage", maxCount: 1 }, // If ground image exists
]);

module.exports = upload;
