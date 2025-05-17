const PDFDocument = require('pdfkit');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary'); // adjust if path is different
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

        const doc = new PDFDocument();
        let pdfBuffer = [];

        doc.on('data', chunk => pdfBuffer.push(chunk));
        doc.on('end', async () => {
            const buffer = Buffer.concat(pdfBuffer);

            const uploadStream = cloudinary.uploader.upload_stream(
                { resource_type: 'raw', folder: 'tournament_fixtures' },
                async (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        return;
                    }

                    // Update tournament with PDF URL
                    tournament.fixturePDFUrl = result.secure_url;
                    tournament.autoFixtureGenerated = true;
                    await tournament.save();
                }
            );

            streamifier.createReadStream(buffer).pipe(uploadStream);
        });

        doc.fontSize(18).text(`${tournament.tournamentName}`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(14).text(`Organized by: ${tournament.organizerName || 'N/A'}`, { align: 'center' });
        doc.text(`Tournament Dates: ${new Date(tournament.startDate).toDateString()} - ${new Date(tournament.endDate).toDateString()}`, { align: 'center' });
        doc.moveDown(1);

        doc.fontSize(16).text('Fixtures:', { underline: true });
        doc.moveDown(0.5);

        fixtures.forEach((match, index) => {
            doc.fontSize(12).text(`Match ${index + 1}: ${match.team1} vs ${match.team2}`);
        });

        doc.end();

    } catch (err) {
        console.error('Auto fixture PDF generation failed:', err);
    }
};

module.exports = {
  generateFixturePDF,
  generateFixturePDFForAutoCall
};

