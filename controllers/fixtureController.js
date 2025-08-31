const PDFDocument = require('pdfkit');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinaryConfig'); // adjust if path is different
const Tournament = require('../models/tournament');
const Team = require('../models/team');
const Match = require('../models/match'); // optional if you want to save matches

const generateFixturePDF = async (req, res) => {
    try {
        const tournamentId = req.params.tournamentId;
        const tournament = await Tournament.findById(tournamentId).populate('teams');

        if (!tournament) {
            return res.status(404).json({ message: 'Tournament not found' });
        }

        const teams = tournament.teams;

        if (teams.length < 2) {
            return res.status(400).json({ message: 'Not enough teams to create fixtures' });
        }

        // Shuffle teams
        const shuffled = [...teams].sort(() => 0.5 - Math.random());

        // Pair teams into matches
        const fixtures = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                fixtures.push({
                    team1: shuffled[i].teamName,
                    team2: shuffled[i + 1].teamName
                });
            } else {
                // Bye round
                fixtures.push({
                    team1: shuffled[i].teamName,
                    team2: 'BYE'
                });
            }
        }

        // Create PDF
        const doc = new PDFDocument();
        let pdfBuffer = [];

        doc.on('data', chunk => pdfBuffer.push(chunk));
        doc.on('end', async () => {
            const buffer = Buffer.concat(pdfBuffer);

            // Upload to Cloudinary
            const uploadStream = cloudinary.uploader.upload_stream(
                { resource_type: 'raw', folder: 'tournament_fixtures' },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        return res.status(500).json({ message: 'Cloudinary upload failed' });
                    }
                    return res.status(200).json({ url: result.secure_url });
                }
            );

            streamifier.createReadStream(buffer).pipe(uploadStream);
        });

        // PDF Header
        doc.fontSize(18).text(`${tournament.tournamentName}`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(14).text(`Organized by: ${tournament.organizerName || 'N/A'}`, { align: 'center' });
        doc.text(`Tournament Dates: ${new Date(tournament.startDate).toDateString()} - ${new Date(tournament.endDate).toDateString()}`, { align: 'center' });
        doc.moveDown(1);

        // Fixtures
        doc.fontSize(16).text('Fixtures:', { underline: true });
        doc.moveDown(0.5);

        fixtures.forEach((match, index) => {
            doc.fontSize(12).text(`Match ${index + 1}: ${match.team1} vs ${match.team2}`);
        });

        doc.end();

    } catch (err) {
        console.error('Fixture generation failed:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const generateFixturePDFForAutoCall = async (tournamentId) => {
    try {
        const tournament = await Tournament.findById(tournamentId).populate('teams');
        if (!tournament) return;

        const teams = tournament.teams;
        if (teams.length < 2) return;

        const shuffled = [...teams].sort(() => 0.5 - Math.random());

        const fixtures = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                fixtures.push({ team1: shuffled[i].teamName, team2: shuffled[i + 1].teamName });
            } else {
                fixtures.push({ team1: shuffled[i].teamName, team2: 'BYE' });
            }
        }

        // Create PDF document
        const doc = new PDFDocument({ 
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });
        let pdfBuffer = [];

        doc.on('data', chunk => pdfBuffer.push(chunk));
        doc.on('end', async () => {
            const buffer = Buffer.concat(pdfBuffer);

            // Upload PDF to Cloudinary
            const pdfUploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'raw',
                    folder: 'tournament_fixtures',
                    public_id: `fixture_${tournament._id}.pdf`
                },
                async (error, pdfResult) => {
                    if (error) {
                        console.error('PDF Cloudinary upload error:', error);
                        return;
                    }

                    // Now generate image version for preview
                    await generateFixtureImage(tournament, fixtures, pdfResult.secure_url);
                }
            );

            streamifier.createReadStream(buffer).pipe(pdfUploadStream);
        });

        // Generate PDF content
        doc.fontSize(20).text(`${tournament.tournamentName}`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(14).text(`Organized by: ${tournament.organizerName || 'N/A'}`, { align: 'center' });
        doc.text(`Tournament Dates: ${new Date(tournament.startDate).toDateString()} - ${new Date(tournament.endDate).toDateString()}`, { align: 'center' });
        doc.moveDown(1);

        doc.fontSize(16).text('Fixtures:', { underline: true });
        doc.moveDown(0.5);

        fixtures.forEach((match, index) => {
            doc.fontSize(12).text(`Match ${index + 1}: ${match.team1} vs ${match.team2}`);
            doc.moveDown(0.3);
        });

        doc.end();

    } catch (err) {
        console.error('Auto fixture PDF generation failed:', err);
    }
};

// Generate image version for preview
const generateFixtureImage = async (tournament, fixtures, pdfUrl) => {
    try {
        // Create a new PDF document for image conversion with white background
        const imgDoc = new PDFDocument({ 
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });
        let imgBuffer = [];

        imgDoc.on('data', chunk => imgBuffer.push(chunk));
        imgDoc.on('end', async () => {
            const buffer = Buffer.concat(imgBuffer);

            // Upload as image to Cloudinary (Cloudinary can convert PDF to image)
            const imgUploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'image',
                    folder: 'tournament_fixtures',
                    public_id: `fixture_${tournament._id}_preview`,
                    format: 'jpg',
                    quality: 'auto',
                    background: 'white'
                },
                async (error, imgResult) => {
                    if (error) {
                        console.error('Image Cloudinary upload error:', error);
                        return;
                    }

                    // Save both URLs to tournament
                    tournament.fixturePDFUrl = pdfUrl;
                    tournament.fixtureImageUrl = imgResult.secure_url;
                    tournament.autoFixtureGenerated = true;
                    await tournament.save();
                    
                    console.log('✅ Both PDF and image fixtures generated successfully');
                }
            );

            streamifier.createReadStream(buffer).pipe(imgUploadStream);
        });

        // Generate same content for image
        imgDoc.fontSize(20).text(`${tournament.tournamentName}`, { align: 'center' });
        imgDoc.moveDown(0.5);
        imgDoc.fontSize(14).text(`Organized by: ${tournament.organizerName || 'N/A'}`, { align: 'center' });
        imgDoc.text(`Tournament Dates: ${new Date(tournament.startDate).toDateString()} - ${new Date(tournament.endDate).toDateString()}`, { align: 'center' });
        imgDoc.moveDown(1);

        imgDoc.fontSize(16).text('Fixtures:', { underline: true });
        imgDoc.moveDown(0.5);

        fixtures.forEach((match, index) => {
            imgDoc.fontSize(12).text(`Match ${index + 1}: ${match.team1} vs ${match.team2}`);
            imgDoc.moveDown(0.3);
        });

        imgDoc.end();

    } catch (err) {
        console.error('Fixture image generation failed:', err);
    }
};

module.exports = {
  generateFixturePDF,
  generateFixturePDFForAutoCall
};

