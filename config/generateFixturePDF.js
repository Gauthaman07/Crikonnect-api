const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateFixturePDF = (tournament, fixtures, outputPath) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const filePath = path.join(outputPath, `${tournament.tournamentName.replace(/\s+/g, '_')}_fixtures.pdf`);
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);

        // Title
        doc.fontSize(20).text('Tournament Fixtures', { align: 'center' });
        doc.moveDown();

        // Tournament Info
        doc.fontSize(14).text(`Tournament Name: ${tournament.tournamentName}`);
        doc.text(`Organized By: ${tournament.organizerName}`);
        doc.text(`Start Date: ${new Date(tournament.startDate).toDateString()}`);
        doc.moveDown();

        // Fixtures
        doc.fontSize(16).text('Fixtures:', { underline: true });
        doc.moveDown(0.5);

        fixtures.forEach((match, index) => {
            doc.fontSize(14).text(`${index + 1}. ${match.team1} vs ${match.team2}`);
        });

        doc.end();

        writeStream.on('finish', () => {
            resolve(filePath); // Return file path
        });

        writeStream.on('error', reject);
    });
};
