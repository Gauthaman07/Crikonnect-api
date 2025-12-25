const cron = require('node-cron');
const GuestMatchRequest = require('../models/guestMatchRequest');
const Team = require('../models/team');
const User = require('../models/User');
const transporter = require('../config/emailConfig');
const { sendPushNotification } = require('./notificationService');

// Function to send match reminders
const sendMatchReminders = async () => {
    try {
        console.log('🕐 Checking for matches to send reminders...');

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        // Set to start of tomorrow
        const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0));
        // Set to end of tomorrow
        const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999));

        // Find all approved matches for tomorrow
        const upcomingMatches = await GuestMatchRequest.find({
            status: 'approved',
            requestedDate: {
                $gte: startOfTomorrow,
                $lte: endOfTomorrow,
            },
        })
        .populate('groundId', 'groundName location')
        .populate({
            path: 'teamA',
            populate: { path: 'createdBy', select: 'name email _id' }
        })
        .populate({
            path: 'teamB',
            populate: { path: 'createdBy', select: 'name email _id' }
        });

        console.log(`📋 Found ${upcomingMatches.length} matches for tomorrow.`);

        if (upcomingMatches.length === 0) {
            return;
        }

        for (const match of upcomingMatches) {
            const { teamA, teamB, groundId, requestedDate, timeSlot } = match;
            
            // Just in case teams or creators are missing
            if (!teamA?.createdBy || !teamB?.createdBy) {
                console.log(`⏭️ Skipping match ID ${match._id} due to missing team/owner data.`);
                continue;
            }

            const participants = [teamA.createdBy, teamB.createdBy];
            const formattedDate = requestedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Send reminders to both team owners
            for (const user of participants) {
                try {
                    // 1. Send Push Notification
                    const notificationTitle = 'Friendly Match Reminder! 🏏';
                    const notificationBody = `Your match ${teamA.teamName} vs ${teamB.teamName} is scheduled for tomorrow at ${groundId.groundName}.`;
                    
                    await sendPushNotification(
                        user._id,
                        { title: notificationTitle, body: notificationBody },
                        { matchId: match._id.toString(), type: 'match_reminder' }
                    );

                    // 2. Send Email
                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: user.email,
                        subject: 'Friendly Match Reminder! 🏏',
                        html: `
                            <h2>Friendly Match Reminder</h2>
                            <p>Hi ${user.name},</p>
                            <p>This is a reminder for your match scheduled for tomorrow.</p>
                            <h3>Match Details:</h3>
                            <ul>
                                <li><strong>Match:</strong> ${teamA.teamName} vs ${teamB.teamName}</li>
                                <li><strong>Venue:</strong> ${groundId.groundName}, ${groundId.location}</li>
                                <li><strong>Date:</strong> ${formattedDate}</li>
                                <li><strong>Time Slot:</strong> ${timeSlot.charAt(0).toUpperCase() + timeSlot.slice(1)}</li>
                            </ul>
                            <p>Please be on time and enjoy the game!</p>
                            <p>Best Regards,<br/>Crickonnect Team</p>
                        `
                    };
                    
                    await transporter.sendMail(mailOptions);
                    console.log(`✅ Reminder sent to ${user.email} for match ${match._id}`);

                } catch (error) {
                    console.error(`❌ Failed to send reminder to ${user.email} for match ${match._id}:`, error);
                }
            }
        }
        console.log('🎉 Match reminder process completed!');

    } catch (error) {
        console.error('💥 Error in sendMatchReminders job:', error);
    }
};

// Schedule the cron job to run every day at 7:00 PM IST
const startReminderCron = () => {
    // Cron for 7 PM is '0 19 * * *'
    cron.schedule('0 19 * * *', () => {
        console.log('⏰ Daily 7 PM cron job triggered - sending match reminders for tomorrow');
        sendMatchReminders();
    }, {
        timezone: "Asia/Kolkata" 
    });
    
    console.log('⏰ Match reminder cron job started - will run every day at 7:00 PM IST');
};

module.exports = {
    startReminderCron,
    sendMatchReminders
};
