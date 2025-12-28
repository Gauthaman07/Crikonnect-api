/**
 * Fix Team Members Script
 *
 * Adds team creators to their team's members array if not already included
 *
 * Usage: node fix-team-members.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Team = require('./models/team');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sportsBooking';

async function fixTeamMembers() {
    try {
        console.log('🔧 Starting team members fix...\n');

        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all teams
        const allTeams = await Team.find({});
        console.log(`📊 Found ${allTeams.length} teams\n`);

        let fixedCount = 0;
        let alreadyOkCount = 0;

        for (const team of allTeams) {
            const creatorId = team.createdBy.toString();
            const members = team.members.map(m => m.toString());

            if (!members.includes(creatorId)) {
                // Creator not in members - add them
                team.members.push(team.createdBy);
                await team.save();

                console.log(`✅ Fixed team: ${team.teamName}`);
                console.log(`   - Creator: ${creatorId}`);
                console.log(`   - Members before: [${members.join(', ')}]`);
                console.log(`   - Members after: [${team.members.map(m => m.toString()).join(', ')}]\n`);

                fixedCount++;
            } else {
                alreadyOkCount++;
            }
        }

        console.log('\n📈 SUMMARY:');
        console.log(`   - Total teams: ${allTeams.length}`);
        console.log(`   - Teams fixed: ${fixedCount}`);
        console.log(`   - Teams already OK: ${alreadyOkCount}`);
        console.log('\n✅ Fix completed successfully!');

    } catch (error) {
        console.error('❌ Error during fix:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the fix
fixTeamMembers();
