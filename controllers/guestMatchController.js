const GuestMatchRequest = require('../models/guestMatchRequest');
const WeeklyAvailability = require('../models/weeklyAvailability');
const Team = require('../models/team');
const Ground = require('../models/ground');
const User = require('../models/User');
const { sendPushNotification } = require('../services/notificationService');
const transporter = require('../config/emailConfig');

// Helper function to get Monday of the week
const getMondayOfWeek = (date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

// Request a guest match slot
const requestGuestMatch = async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            groundId, 
            requestedDate, 
            timeSlot, 
            teamAId, 
            teamBId, 
            matchDescription 
        } = req.body;
        
        // Validation
        if (!groundId || !requestedDate || !timeSlot || !teamAId || !teamBId) {
            return res.status(400).json({ 
                message: 'Required fields missing: groundId, requestedDate, timeSlot, teamAId, teamBId' 
            });
        }
        
        if (!['morning', 'afternoon'].includes(timeSlot)) {
            return res.status(400).json({ message: 'Invalid time slot.' });
        }
        
        if (teamAId === teamBId) {
            return res.status(400).json({ message: 'Teams must be different.' });
        }
        
        // Verify user is part of teamA (requesting team)
        const requestingTeam = await Team.findOne({
            _id: teamAId,
            $or: [{ createdBy: userId }, { members: userId }]
        });
        
        if (!requestingTeam) {
            return res.status(403).json({ 
                message: 'You must be a member of the requesting team.' 
            });
        }
        
        // Verify ground exists and get owner info
        const ground = await Ground.findById(groundId).populate('ownedByTeam');
        if (!ground) {
            return res.status(404).json({ message: 'Ground not found.' });
        }
        
        if (!ground.ownedByTeam) {
            return res.status(400).json({ 
                message: 'This ground is not owned by any team.' 
            });
        }
        
        // Verify teamB exists
        const opponentTeam = await Team.findById(teamBId);
        if (!opponentTeam) {
            return res.status(404).json({ message: 'Opponent team not found.' });
        }
        
        // Get the Monday of the requested week
        const requestedDateObj = new Date(requestedDate);
        const monday = getMondayOfWeek(requestedDateObj);
        
        // Find weekly availability
        const weeklyAvailability = await WeeklyAvailability.findOne({
            groundId: groundId,
            weekStartDate: monday
        });
        
        if (!weeklyAvailability) {
            return res.status(404).json({ 
                message: 'No availability schedule found for this week.' 
            });
        }
        
        // Determine the day of week
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[requestedDateObj.getDay()];
        
        // Check if the slot is available for guest matches
        const slot = weeklyAvailability.schedule[dayName][timeSlot];
        if (slot.mode !== 'guest_match') {
            return res.status(400).json({ 
                message: 'This slot is not available for guest matches.' 
            });
        }
        
        if (slot.guestMatchRequest) {
            return res.status(400).json({ 
                message: 'This slot already has a pending guest match request.' 
            });
        }
        
        // Create guest match request
        const guestMatchRequest = new GuestMatchRequest({
            groundId,
            ownerTeamId: ground.ownedByTeam._id,
            requestedDate: requestedDateObj,
            timeSlot,
            teamA: teamAId,
            teamB: teamBId,
            requestedBy: userId,
            matchDescription: matchDescription || '',
            weeklyAvailabilityId: weeklyAvailability._id,
            matchFee: ground.fee || 0
        });
        
        await guestMatchRequest.save();
        
        // Update the weekly availability slot
        weeklyAvailability.schedule[dayName][timeSlot].guestMatchRequest = guestMatchRequest._id;
        await weeklyAvailability.save();
        
        // Get ground owner details for notifications
        const groundOwner = await User.findById(ground.ownedByTeam.createdBy);
        
        // Format date for notifications
        const formattedDate = requestedDateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Send push notification to ground owner
        try {
            const notificationTitle = 'New Guest Match Request';
            const notificationBody = `${requestingTeam.teamName} vs ${opponentTeam.teamName} wants to play at ${ground.groundName} on ${formattedDate} ${timeSlot}`;
            
            const notificationData = {
                requestId: guestMatchRequest._id.toString(),
                groundId: ground._id.toString(),
                groundName: ground.groundName,
                teamA: requestingTeam.teamName,
                teamB: opponentTeam.teamName,
                date: formattedDate,
                timeSlot: timeSlot,
                type: 'guest_match_request'
            };
            
            await sendPushNotification(
                groundOwner._id,
                { title: notificationTitle, body: notificationBody },
                notificationData
            );
            
            console.log('Push notification sent to ground owner');
        } catch (pushError) {
            console.error('Error sending push notification:', pushError);
        }
        
        // Send email notification
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: groundOwner.email,
                subject: 'New Guest Match Request',
                html: `
                    <h2>New Guest Match Request</h2>
                    <p>You have received a new guest match request for your ground.</p>
                    <h3>Match Details:</h3>
                    <ul>
                        <li><strong>Teams:</strong> ${requestingTeam.teamName} vs ${opponentTeam.teamName}</li>
                        <li><strong>Ground:</strong> ${ground.groundName}</li>
                        <li><strong>Date:</strong> ${formattedDate}</li>
                        <li><strong>Time Slot:</strong> ${timeSlot}</li>
                        <li><strong>Match Fee:</strong> ₹${ground.fee || 0}</li>
                        ${matchDescription ? `<li><strong>Description:</strong> ${matchDescription}</li>` : ''}
                    </ul>
                    <p>Please log in to your account to approve or reject this request.</p>
                `
            };
            
            await transporter.sendMail(mailOptions);
        } catch (emailError) {
            console.error('Error sending email:', emailError);
        }
        
        res.status(201).json({
            success: true,
            message: 'Guest match request created successfully.',
            request: {
                requestId: guestMatchRequest._id,
                groundName: ground.groundName,
                date: formattedDate,
                timeSlot,
                teamA: requestingTeam.teamName,
                teamB: opponentTeam.teamName,
                status: 'pending'
            }
        });
        
    } catch (error) {
        console.error('Error requesting guest match:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Approve or reject guest match request
const respondToGuestMatch = async (req, res) => {
    try {
        const userId = req.user.id;
        const { requestId } = req.params;
        const { status, responseNote } = req.body;
        
        // Accept both frontend status values and convert to appropriate backend status
        if (!['approved', 'rejected', 'booked'].includes(status)) {
            return res.status(400).json({ 
                message: 'Status must be either "approved", "booked", or "rejected".' 
            });
        }
        
        // Convert "booked" to "approved" for database storage (frontend compatibility)
        const dbStatus = status === 'booked' ? 'approved' : status;
        
        // Find the request
        const guestRequest = await GuestMatchRequest.findById(requestId)
            .populate('groundId')
            .populate('teamA', 'teamName teamLogo createdBy')
            .populate('teamB', 'teamName teamLogo')
            .populate('ownerTeamId', 'createdBy');
        
        if (!guestRequest) {
            return res.status(404).json({ message: 'Guest match request not found.' });
        }
        
        // Verify user is the ground owner
        if (guestRequest.ownerTeamId.createdBy.toString() !== userId) {
            return res.status(403).json({ 
                message: 'Only the ground owner can respond to this request.' 
            });
        }
        
        if (guestRequest.status !== 'pending') {
            return res.status(400).json({ 
                message: 'This request has already been responded to.' 
            });
        }
        
        // Update request status
        guestRequest.status = dbStatus;
        guestRequest.responseDate = new Date();
        guestRequest.responseNote = responseNote || '';
        guestRequest.respondedBy = userId;
        await guestRequest.save();
        
        // If rejected, clear the guest match request from weekly availability
        if (dbStatus === 'rejected') {
            const weeklyAvailability = await WeeklyAvailability.findById(guestRequest.weeklyAvailabilityId);
            if (weeklyAvailability) {
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const dayName = dayNames[guestRequest.requestedDate.getDay()];
                
                if (weeklyAvailability.schedule[dayName][guestRequest.timeSlot].guestMatchRequest?.toString() === requestId) {
                    weeklyAvailability.schedule[dayName][guestRequest.timeSlot].guestMatchRequest = null;
                    await weeklyAvailability.save();
                }
            }
        }
        
        // Get requesting team owner for notifications
        const requestingTeamOwner = await User.findById(guestRequest.teamA.createdBy);
        
        // Format date for notifications
        const formattedDate = guestRequest.requestedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Send push notification to requesting team
        try {
            const notificationTitle = `Guest Match Request ${dbStatus === 'approved' ? 'Approved' : 'Rejected'}`;
            const notificationBody = `Your match request for ${guestRequest.groundId.groundName} on ${formattedDate} has been ${dbStatus}.`;
            
            const notificationData = {
                requestId: guestRequest._id.toString(),
                groundId: guestRequest.groundId._id.toString(),
                groundName: guestRequest.groundId.groundName,
                date: formattedDate,
                timeSlot: guestRequest.timeSlot,
                status: dbStatus,
                type: 'guest_match_response'
            };
            
            await sendPushNotification(
                requestingTeamOwner._id,
                { title: notificationTitle, body: notificationBody },
                notificationData
            );
            
            console.log('Push notification sent to requesting team');
        } catch (pushError) {
            console.error('Error sending push notification:', pushError);
        }
        
        // Send email notification
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: requestingTeamOwner.email,
                subject: `Guest Match Request ${dbStatus === 'approved' ? 'Approved' : 'Rejected'}`,
                html: `
                    <h2>Match Request ${dbStatus === 'approved' ? 'Approved' : 'Rejected'}</h2>
                    <p>Your guest match request has been ${dbStatus}.</p>
                    <h3>Match Details:</h3>
                    <ul>
                        <li><strong>Teams:</strong> ${guestRequest.teamA.teamName} vs ${guestRequest.teamB.teamName}</li>
                        <li><strong>Ground:</strong> ${guestRequest.groundId.groundName}</li>
                        <li><strong>Date:</strong> ${formattedDate}</li>
                        <li><strong>Time Slot:</strong> ${guestRequest.timeSlot}</li>
                        ${status === 'approved' ? `
                            <li><strong>Match Fee:</strong> ₹${guestRequest.matchFee}</li>
                            <li><strong>Ground Location:</strong> ${guestRequest.groundId.location}</li>
                        ` : ''}
                    </ul>
                    ${responseNote ? `<p><strong>Note from ground owner:</strong> ${responseNote}</p>` : ''}
                    ${status === 'approved' ? 
                        '<p>Please ensure your team arrives on time and follows all ground rules.</p>' : 
                        '<p>You can try booking another available slot.</p>'
                    }
                `
            };
            
            await transporter.sendMail(mailOptions);
        } catch (emailError) {
            console.error('Error sending email:', emailError);
        }
        
        res.status(200).json({
            success: true,
            message: `Guest match request ${status} successfully.`,
            request: {
                requestId: guestRequest._id,
                status: dbStatus,
                responseDate: guestRequest.responseDate,
                responseNote: guestRequest.responseNote
            }
        });
        
    } catch (error) {
        console.error('Error responding to guest match:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get pending guest match requests for ground owner
const getPendingGuestRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Find user's team that owns a ground
        const ownerTeam = await Team.findOne({ 
            createdBy: userId, 
            hasOwnGround: true 
        });
        
        if (!ownerTeam) {
            return res.status(404).json({ 
                message: 'No ground found for this user.' 
            });
        }
        
        // Get pending requests
        const pendingRequests = await GuestMatchRequest.find({
            ownerTeamId: ownerTeam._id,
            status: 'pending'
        })
        .populate('groundId', 'groundName location')
        .populate('teamA', 'teamName teamLogo')
        .populate('teamB', 'teamName teamLogo')
        .populate('requestedBy', 'name email')
        .sort({ createdAt: -1 });
        
        // Format the requests
        const formattedRequests = pendingRequests.map(request => ({
            requestId: request._id,
            groundName: request.groundId.groundName,
            groundLocation: request.groundId.location,
            teamA: {
                name: request.teamA.teamName,
                logo: request.teamA.teamLogo
            },
            teamB: {
                name: request.teamB.teamName,
                logo: request.teamB.teamLogo
            },
            requestedBy: request.requestedBy.name,
            date: request.requestedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            timeSlot: request.timeSlot,
            matchDescription: request.matchDescription,
            matchFee: request.matchFee,
            createdAt: request.createdAt
        }));
        
        res.status(200).json({
            success: true,
            message: 'Pending guest match requests retrieved successfully.',
            requests: formattedRequests
        });
        
    } catch (error) {
        console.error('Error getting pending guest requests:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    requestGuestMatch,
    respondToGuestMatch,
    getPendingGuestRequests
};