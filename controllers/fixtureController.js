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

        // Generate enhanced PDF content
        const pageWidth = 495; // A4 width minus margins

        // Header
        doc.fontSize(24).font('Helvetica-Bold')
           .text(tournament.tournamentName.toUpperCase(), { align: 'center' });
        doc.moveDown(0.3);
        
        doc.fontSize(14).font('Helvetica')
           .text('TOURNAMENT FIXTURES', { align: 'center' });
        doc.moveDown(0.8);

        // Tournament details
        doc.fontSize(12).font('Helvetica');
        doc.text(`Organized by: ${tournament.organizerName || 'N/A'}`, { align: 'left' });
        
        const startDate = new Date(tournament.startDate).toLocaleDateString('en-GB');
        const endDate = new Date(tournament.endDate).toLocaleDateString('en-GB');
        doc.text(`Tournament Dates: ${startDate} - ${endDate}`);
        doc.text(`Location: ${tournament.location}`);
        doc.text(`Teams: ${tournament.numberOfTeams} • Type: ${tournament.tournamentType}`);
        doc.text(`Entry Fee: ₹${tournament.entryFee} • Prize: ${tournament.winningPrize}`);
        doc.moveDown(1);

        // Fixtures section
        doc.fontSize(16).font('Helvetica-Bold')
           .text('MATCH FIXTURES', { align: 'center', underline: true });
        doc.moveDown(0.5);

        // Enhanced fixture listing
        fixtures.forEach((match, index) => {
            doc.fontSize(14).font('Helvetica-Bold');
            doc.text(`MATCH ${index + 1}`, { continued: false });
            doc.moveDown(0.2);
            
            doc.fontSize(12).font('Helvetica');
            doc.text(`${match.team1}  VS  ${match.team2}`, { align: 'center' });
            doc.text(`${tournament.oversPerMatch} Overs • ${tournament.ballType}`, { align: 'center' });
            doc.moveDown(0.5);
            
            // Add separator line
            if (index < fixtures.length - 1) {
                doc.text('─'.repeat(50), { align: 'center' });
                doc.moveDown(0.3);
            }
        });

        // Footer
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica')
           .text('Generated by CrikConnect Tournament Management System', { align: 'center' });
        
        const generatedAt = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata'
        });
        doc.text(`Generated on: ${generatedAt}`, { align: 'center' });

        doc.end();

    } catch (err) {
        console.error('Auto fixture PDF generation failed:', err);
    }
};

// Generate professional image version for preview
const generateFixtureImage = async (tournament, fixtures, pdfUrl) => {
    try {
        // Create enhanced PDF document for better image conversion
        const imgDoc = new PDFDocument({ 
            size: 'A4',
            margins: { top: 30, bottom: 30, left: 30, right: 30 }
        });
        let imgBuffer = [];

        imgDoc.on('data', chunk => imgBuffer.push(chunk));
        imgDoc.on('end', async () => {
            const buffer = Buffer.concat(imgBuffer);

            // Upload as high-quality image to Cloudinary
            const imgUploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'image',
                    folder: 'tournament_fixtures',
                    public_id: `fixture_${tournament._id}_preview`,
                    format: 'jpg',
                    quality: '90',
                    background: 'white',
                    dpr: '2.0' // High DPI for crisp images
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
                    
                    console.log('✅ Professional fixture image and PDF generated successfully');
                }
            );

            streamifier.createReadStream(buffer).pipe(imgUploadStream);
        });

        const pageWidth = 535; // A4 width minus margins
        const pageHeight = 782; // A4 height minus margins

        // === HEADER SECTION ===
        // Header background gradient effect (using rectangles)
        imgDoc.rect(0, 0, 595, 120).fill('#1e40af'); // Blue header background
        imgDoc.rect(0, 100, 595, 20).fill('#3b82f6'); // Lighter blue gradient

        // Tournament title
        imgDoc.fillColor('white')
               .font('Helvetica-Bold')
               .fontSize(28)
               .text(tournament.tournamentName.toUpperCase(), 30, 35, { 
                   align: 'center',
                   width: pageWidth
               });

        // Subtitle
        imgDoc.fontSize(14)
               .fillColor('#e0e7ff')
               .text('TOURNAMENT FIXTURES', 30, 70, { 
                   align: 'center',
                   width: pageWidth
               });

        // === TOURNAMENT INFO SECTION ===
        let yPos = 150;
        
        // Info background
        imgDoc.rect(30, yPos - 10, pageWidth, 80).fill('#f8fafc').stroke('#e2e8f0');

        // Tournament details with icons (using symbols)
        imgDoc.fillColor('#374151').font('Helvetica').fontSize(12);
        
        // Organizer
        imgDoc.text('👤 Organized by:', 50, yPos)
               .font('Helvetica-Bold')
               .text(tournament.organizerName || 'N/A', 150, yPos);

        yPos += 20;
        
        // Dates
        const startDate = new Date(tournament.startDate).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        const endDate = new Date(tournament.endDate).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        
        imgDoc.font('Helvetica').text('📅 Tournament Dates:', 50, yPos)
               .font('Helvetica-Bold')
               .text(`${startDate} - ${endDate}`, 180, yPos);

        yPos += 20;
        
        // Location and teams
        imgDoc.font('Helvetica').text('📍 Location:', 50, yPos)
               .font('Helvetica-Bold')
               .text(tournament.location, 120, yPos);
               
        imgDoc.font('Helvetica').text('🏏 Teams:', 300, yPos)
               .font('Helvetica-Bold')
               .text(`${tournament.numberOfTeams} Teams`, 350, yPos);

        yPos += 40;

        // === FIXTURES SECTION ===
        // Section header
        imgDoc.rect(30, yPos, pageWidth, 40).fill('#059669').stroke('#047857'); // Green header
        
        imgDoc.fillColor('white')
               .font('Helvetica-Bold')
               .fontSize(18)
               .text('MATCH FIXTURES', 30, yPos + 12, { 
                   align: 'center',
                   width: pageWidth
               });

        yPos += 60;

        // === INDIVIDUAL MATCHES ===
        fixtures.forEach((match, index) => {
            // Check if we need a new page
            if (yPos > 650) {
                imgDoc.addPage();
                yPos = 80;
            }

            // Match container background
            const matchBgColor = index % 2 === 0 ? '#f1f5f9' : '#ffffff';
            imgDoc.rect(30, yPos - 5, pageWidth, 65).fill(matchBgColor).stroke('#cbd5e1');

            // Match number badge
            imgDoc.rect(40, yPos + 5, 80, 25).fill('#dc2626').stroke('#b91c1c'); // Red badge
            imgDoc.fillColor('white')
                   .font('Helvetica-Bold')
                   .fontSize(12)
                   .text(`MATCH ${index + 1}`, 40, yPos + 12, { 
                       align: 'center',
                       width: 80
                   });

            // Team 1
            imgDoc.fillColor('#1f2937')
                   .font('Helvetica-Bold')
                   .fontSize(16)
                   .text(match.team1, 140, yPos + 15);

            // VS text
            imgDoc.rect(320, yPos + 10, 40, 20).fill('#6366f1').stroke('#4f46e5'); // Purple VS box
            imgDoc.fillColor('white')
                   .font('Helvetica-Bold')
                   .fontSize(12)
                   .text('VS', 320, yPos + 16, { 
                       align: 'center',
                       width: 40
                   });

            // Team 2
            imgDoc.fillColor('#1f2937')
                   .font('Helvetica-Bold')
                   .fontSize(16)
                   .text(match.team2, 380, yPos + 15);

            // Match details line
            imgDoc.fillColor('#6b7280')
                   .font('Helvetica')
                   .fontSize(10)
                   .text(`${tournament.tournamentType} • ${tournament.oversPerMatch} Overs • ${tournament.ballType}`, 140, yPos + 40);

            yPos += 80;
        });

        // === FOOTER ===
        if (yPos < 700) {
            yPos = 720;
        } else {
            imgDoc.addPage();
            yPos = 700;
        }

        // Footer background
        imgDoc.rect(0, yPos, 595, 82).fill('#1f2937');
        
        // Footer text
        imgDoc.fillColor('#9ca3af')
               .font('Helvetica')
               .fontSize(10)
               .text('Generated by CrikConnect • Tournament Management System', 30, yPos + 15, { 
                   align: 'center',
                   width: pageWidth
               });

        // Tournament info in footer
        imgDoc.fontSize(8)
               .text(`Entry Fee: ₹${tournament.entryFee} • Winning Prize: ${tournament.winningPrize} • Ball Type: ${tournament.ballType}`, 
                      30, yPos + 35, { 
                          align: 'center',
                          width: pageWidth
                      });

        // Generation timestamp
        const generatedAt = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        imgDoc.text(`Generated on: ${generatedAt}`, 30, yPos + 55, { 
            align: 'center',
            width: pageWidth
        });

        imgDoc.end();

    } catch (err) {
        console.error('Professional fixture image generation failed:', err);
        // Fallback to simple version if enhanced version fails
        await generateSimpleFixtureImage(tournament, fixtures, pdfUrl);
    }
};

// Fallback simple fixture generator
const generateSimpleFixtureImage = async (tournament, fixtures, pdfUrl) => {
    try {
        const imgDoc = new PDFDocument({ size: 'A4' });
        let imgBuffer = [];

        imgDoc.on('data', chunk => imgBuffer.push(chunk));
        imgDoc.on('end', async () => {
            const buffer = Buffer.concat(imgBuffer);
            
            const imgUploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'image',
                    folder: 'tournament_fixtures',
                    public_id: `fixture_${tournament._id}_preview_simple`,
                    format: 'jpg',
                    quality: '85',
                    background: 'white'
                },
                async (error, imgResult) => {
                    if (error) {
                        console.error('Simple image upload error:', error);
                        return;
                    }

                    tournament.fixturePDFUrl = pdfUrl;
                    tournament.fixtureImageUrl = imgResult.secure_url;
                    tournament.autoFixtureGenerated = true;
                    await tournament.save();
                }
            );

            streamifier.createReadStream(buffer).pipe(imgUploadStream);
        });

        // Simple fallback design
        imgDoc.fontSize(20).text(tournament.tournamentName, { align: 'center' });
        imgDoc.moveDown().fontSize(14).text('FIXTURES', { align: 'center' });
        imgDoc.moveDown(2);
        
        fixtures.forEach((match, index) => {
            imgDoc.fontSize(12).text(`Match ${index + 1}: ${match.team1} vs ${match.team2}`);
            imgDoc.moveDown(0.5);
        });

        imgDoc.end();
    } catch (err) {
        console.error('Simple fixture generation also failed:', err);
    }
};

module.exports = {
  generateFixturePDF,
  generateFixturePDFForAutoCall
};

