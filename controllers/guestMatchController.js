const GuestMatchRequest = require('../models/guestMatchRequest');
const WeeklyAvailability = require('../models/weeklyAvailability');
const Team = require('../models/team');
const Ground = require('../models/ground');
const User = require('../models/User');
const { sendPushNotification } = require('../services/notificationService');
const transporter = require('../config/emailConfig');

// Helper function to get Monday of the week
const getMondayOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
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
        if (!groundId || !requestedDate || !timeSlot || !teamAId) {
            return res.status(400).json({ 
                message: 'Required fields missing: groundId, requestedDate, timeSlot, teamAId' 
            });
        }
        
        if (!['morning', 'afternoon'].includes(timeSlot)) {
            return res.status(400).json({ message: 'Invalid time slot.' });
        }
        
        // Verify user is part of teamA (requesting team)
        console.log(`DEBUG: Verifying user ${userId} is member of team ${teamAId}`);

        const requestingTeam = await Team.findOne({
            _id: teamAId,
            $or: [
                { createdBy: userId },
                { members: { $in: [userId] } }  // Use $in operator for array membership check
            ]
        });

        console.log(`DEBUG: Team lookup result:`, requestingTeam ? `Found team: ${requestingTeam.teamName}` : 'Team not found or user not a member');

        if (!requestingTeam) {
            // Additional debug info
            const teamExists = await Team.findById(teamAId);
            if (!teamExists) {
                console.log(`ERROR: Team ${teamAId} does not exist in database`);
                return res.status(404).json({
                    message: 'The specified team does not exist.'
                });
            }

            console.log(`ERROR: User ${userId} is not a member of team ${teamAId}`);
            console.log(`Team created by: ${teamExists.createdBy}, Members: ${teamExists.members}`);

            return res.status(403).json({
                message: 'You must be a member of the requesting team.'
            });
        }

        console.log(`DEBUG: User verified as member of team ${requestingTeam.teamName}`);
        
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
        
        const slot = weeklyAvailability.schedule[dayName][timeSlot];

        console.log(`DEBUG: Requesting ${dayName} ${timeSlot} on ${requestedDate}`);
        console.log(`DEBUG: Slot Mode: ${slot.mode}`);
        console.log(`DEBUG: Booked Match ID: ${slot.bookedMatchId}`);

        // Check availability - Verify bookedMatchId actually exists
        if (slot.bookedMatchId) {
            // Validate that the booking actually exists in the database
            const existingBooking = await GuestMatchRequest.findById(slot.bookedMatchId);

            if (existingBooking && existingBooking.status === 'approved') {
                // Valid booking exists
                return res.status(400).json({
                    message: 'This slot is already booked.'
                });
            } else {
                // Stale reference - clean it up
                console.log(`WARNING: Stale bookedMatchId found (${slot.bookedMatchId}). Cleaning up...`);
                weeklyAvailability.schedule[dayName][timeSlot].bookedMatchId = null;

                // Also clean up the guestMatchRequests array from stale IDs
                const requestIds = weeklyAvailability.schedule[dayName][timeSlot].guestMatchRequests || [];
                const validRequestIds = [];

                for (const reqId of requestIds) {
                    const req = await GuestMatchRequest.findById(reqId);
                    if (req && req.status === 'pending') {
                        validRequestIds.push(reqId);
                    }
                }

                weeklyAvailability.schedule[dayName][timeSlot].guestMatchRequests = validRequestIds;
                await weeklyAvailability.save();
                console.log(`Stale references cleared. Valid requests remaining: ${validRequestIds.length}`);
            }
        }

        if (slot.mode === 'unavailable') {
            return res.status(400).json({ 
                message: 'This slot is unavailable.' 
            });
        }

        // --- CORE LOGIC START ---

        let requestToSave = null;
        let isMerge = false;
        let finalTeamBId = teamBId;
        let matchType = 'guest_vs_guest';

        // CASE 1: OWNER PLAY
        if (slot.mode === 'owner_play') {
            // Prevent owner team from booking their own ground
            if (teamAId === ground.ownedByTeam._id.toString()) {
                return res.status(400).json({
                    message: 'Ground owner team cannot book their own ground. Please use availability settings to schedule matches.'
                });
            }

            matchType = 'vs_owner';
            finalTeamBId = ground.ownedByTeam._id; // Force Team B to be Owner
        } 
        // CASE 2: HOST ONLY
        else if (slot.mode === 'host_only') {
            // Prevent owner team from booking in host_only mode (they're hosting, not playing)
            if (teamAId === ground.ownedByTeam._id.toString()) {
                return res.status(400).json({
                    message: 'Ground owner team cannot book in host-only mode. You are hosting this session, not playing.'
                });
            }

            matchType = 'guest_vs_guest';

            // Check if slot already has a complete pair pending approval (block multiple matches per slot)
            const completePair = await GuestMatchRequest.findOne({
                weeklyAvailabilityId: weeklyAvailability._id,
                requestedDate: requestedDateObj,
                timeSlot: timeSlot,
                teamB: { $ne: null }, // Has both teams
                status: 'pending',
                matchType: 'guest_vs_guest'
            });

            if (completePair) {
                return res.status(400).json({
                    message: 'This slot already has a complete match (Team A vs Team B) pending approval. Please choose another slot.'
                });
            }

            // If teamB NOT provided, try Auto-Pairing
            if (!finalTeamBId) {
                // Find a pending SINGLE request for this slot
                const existingSingle = await GuestMatchRequest.findOne({
                    weeklyAvailabilityId: weeklyAvailability._id,
                    requestedDate: requestedDateObj,
                    timeSlot: timeSlot,
                    teamB: null, // Looking for a lonely team
                    status: 'pending',
                    matchType: 'guest_vs_guest'
                });

                if (existingSingle) {
                    // Prevent self-matching
                    if (existingSingle.teamA.toString() === teamAId) {
                        return res.status(400).json({ message: 'You already have a pending request for this slot.' });
                    }

                    // MERGE!
                    existingSingle.teamB = teamAId; // Current team becomes Team B of the match
                    await existingSingle.save();
                    
                    isMerge = true;
                    requestToSave = existingSingle;
                    finalTeamBId = existingSingle.teamB; // for notification
                }
                // If no single exists, we fall through to create a new one (with teamB = null)
            }
        }

        // If not a merge, create NEW Request
        if (!isMerge) {
            // Validate Team B if provided
            if (finalTeamBId) {
                if (finalTeamBId.toString() === teamAId) {
                    return res.status(400).json({ message: 'Teams must be different.' });
                }
            }

            // Check for duplicate request from same team (to prevent spam)
            // Note: We search in the array of IDs
            // This is a bit complex with just IDs, so we query the Collection
            const existingRequest = await GuestMatchRequest.findOne({
                weeklyAvailabilityId: weeklyAvailability._id,
                requestedDate: requestedDateObj,
                timeSlot: timeSlot,
                teamA: teamAId,
                status: 'pending'
            });

             if (existingRequest) {
                return res.status(400).json({ message: 'You already have a pending request for this slot.' });
            }

            requestToSave = new GuestMatchRequest({
                groundId,
                ownerTeamId: ground.ownedByTeam._id,
                requestedDate: requestedDateObj,
                timeSlot,
                teamA: teamAId,
                teamB: finalTeamBId || null, // Can be null for Host Only Single
                matchType,
                requestedBy: userId,
                matchDescription: matchDescription || '',
                weeklyAvailabilityId: weeklyAvailability._id,
                matchFee: ground.fee || 0
            });
            
            await requestToSave.save();

            // Add to Weekly Availability Array
            weeklyAvailability.schedule[dayName][timeSlot].guestMatchRequests.push(requestToSave._id);
            await weeklyAvailability.save();
        }

        // --- NOTIFICATIONS ---
        
        // Get ground owner
        const groundOwner = await User.findById(ground.ownedByTeam.createdBy);
        // Get opponent name (if exists)
        let opponentName = "Waiting for Opponent";
        if (finalTeamBId) {
            const oppTeam = await Team.findById(finalTeamBId);
            opponentName = oppTeam ? oppTeam.teamName : "Unknown";
        }
        
        const formattedDate = requestedDateObj.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // Construct Message
        const title = isMerge ? 'Match Paired & Ready!' : 'New Guest Match Request';
        const body = isMerge 
            ? `Match Paired: ${requestingTeam.teamName} has joined the slot vs ${opponentName}. Ready for your approval.`
            : `${requestingTeam.teamName} requested a slot (${matchType === 'vs_owner' ? 'vs You' : 'Host Only'}).`;

        // Send Notification
        try {
            await sendPushNotification(
                groundOwner._id,
                { title, body },
                {
                    requestId: requestToSave._id.toString(),
                    type: 'guest_match_request'
                }
            );
            console.log('Push notification sent to ground owner');
        } catch (e) { console.error('Push error', e); }

        // Response
        res.status(201).json({
            success: true,
            message: isMerge ? 'Match paired successfully! Waiting for owner approval.' : 'Request sent successfully.',
            request: requestToSave,
            isMerged: isMerge
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
        console.log('🔍 DEBUG: Verifying ground owner');
        console.log('🔍 DEBUG: Logged-in userId:', userId);
        console.log('🔍 DEBUG: ownerTeamId:', guestRequest.ownerTeamId);
        console.log('🔍 DEBUG: ownerTeamId.createdBy:', guestRequest.ownerTeamId.createdBy);
        console.log('🔍 DEBUG: Match?', guestRequest.ownerTeamId.createdBy.toString() === userId);

        if (guestRequest.ownerTeamId.createdBy.toString() !== userId) {
            console.log('❌ DEBUG: Ground owner check FAILED');
            return res.status(403).json({
                message: 'Only the ground owner can respond to this request.'
            });
        }

        console.log('✅ DEBUG: Ground owner check PASSED');
        
        // Allow re-approving if it was just pending, but not if already finalized (unless we want to allow overwrites, but let's be safe)
        if (guestRequest.status !== 'pending') {
            return res.status(400).json({ 
                message: 'This request has already been responded to.' 
            });
        }

        // Check if teamB is present (cannot approve single team request)
        if (dbStatus === 'approved' && !guestRequest.teamB) {
             return res.status(400).json({ 
                message: 'Cannot approve a request with only one team. Wait for another team to join.' 
            });
        }

        // Find Weekly Availability to update schedule
        const weeklyAvailability = await WeeklyAvailability.findById(guestRequest.weeklyAvailabilityId);
        if (!weeklyAvailability) {
            return res.status(404).json({ message: 'Weekly availability not found.' });
        }
        
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[guestRequest.requestedDate.getDay()];
        const slot = weeklyAvailability.schedule[dayName][guestRequest.timeSlot];

        // Check if slot is already booked (double safety)
        if (dbStatus === 'approved' && slot.bookedMatchId) {
             return res.status(400).json({ message: 'This slot is already booked by another team.' });
        }
        
        // Update request status
        guestRequest.status = dbStatus;
        guestRequest.responseDate = new Date();
        guestRequest.responseNote = responseNote || '';
        guestRequest.respondedBy = userId;
        await guestRequest.save();
        
        // HANDLE APPROVAL LOGIC
        if (dbStatus === 'approved') {
            // 1. Mark slot as booked
            weeklyAvailability.schedule[dayName][guestRequest.timeSlot].bookedMatchId = guestRequest._id;
            
            // 2. Reject ALL other pending requests for this slot
            // Get all request IDs for this slot
            const allRequests = weeklyAvailability.schedule[dayName][guestRequest.timeSlot].guestMatchRequests || [];
            
            for (const otherRequestId of allRequests) {
                if (otherRequestId.toString() !== requestId) {
                    await GuestMatchRequest.findByIdAndUpdate(otherRequestId, {
                        status: 'rejected',
                        responseDate: new Date(),
                        responseNote: 'Slot booked by another team.',
                        respondedBy: userId
                    });
                }
            }
            
            // 3. Keep the requests in history, or clear them?
            // Let's keep them in the array for now so the owner can see history, 
            // but the `bookedMatchId` flag indicates the active one.
            
            await weeklyAvailability.save();
        }
        
        // HANDLE REJECTION LOGIC
        if (dbStatus === 'rejected') {
            // If we reject a merged match (A vs B), what happens?
            // Ideally, it just dies. They have to request again.
            // Remove from active array?
             const index = weeklyAvailability.schedule[dayName][guestRequest.timeSlot].guestMatchRequests.indexOf(requestId);
            if (index > -1) {
                weeklyAvailability.schedule[dayName][guestRequest.timeSlot].guestMatchRequests.splice(index, 1);
                await weeklyAvailability.save();
            }
        }
        
        // NOTIFICATIONS (Standard Logic)
        const requestingTeamOwner = await User.findById(guestRequest.teamA.createdBy);
        const formattedDate = guestRequest.requestedDate.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        
        try {
            const notificationTitle = `Match Request ${dbStatus === 'approved' ? 'Approved' : 'Rejected'}`;
            const notificationBody = `Your match request for ${guestRequest.groundId.groundName} on ${formattedDate} has been ${dbStatus}.`;
            
            await sendPushNotification(
                requestingTeamOwner._id,
                { title: notificationTitle, body: notificationBody },
                {
                    requestId: guestRequest._id.toString(),
                    status: dbStatus,
                    type: 'guest_match_response'
                }
            );
            console.log('Push notification sent to Team A');
        } catch (pushError) { console.error('Error sending push notification to Team A:', pushError); }

        // Notify Team B if it exists (for paired matches)
        if (guestRequest.teamB) {
            try {
                const teamBData = await Team.findById(guestRequest.teamB).populate('createdBy');
                if (teamBData && teamBData.createdBy) {
                    await sendPushNotification(
                        teamBData.createdBy._id,
                        { title: notificationTitle, body: notificationBody },
                        {
                            requestId: guestRequest._id.toString(),
                            status: dbStatus,
                            type: 'guest_match_response'
                        }
                    );
                    console.log('Push notification sent to Team B');
                }
            } catch (pushError) { console.error('Error sending push notification to Team B:', pushError); }
        }

        res.status(200).json({
            success: true,
            message: `Guest match request ${status} successfully.`,
            request: guestRequest
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
        }).populate('groundId');

        if (!ownerTeam) {
            // Return empty arrays instead of error - user just doesn't own a ground
            return res.status(200).json({
                success: true,
                message: 'No ground found for this user.',
                pendingRequests: [],
                confirmedMatches: []
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
        .sort({ requestedDate: 1, timeSlot: 1, createdAt: -1 });
        
        // Group pending bookings intelligently
        const groupedRequests = [];
        const processedRequests = new Set();
        
        for (const request of pendingRequests) {
            if (processedRequests.has(request._id.toString())) {
                continue;
            }
            
            const requestDateStr = request.requestedDate.toISOString().split('T')[0];
            const formattedDate = request.requestedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            // Determine type based on matchType or structure
            if (request.matchType === 'vs_owner') {
                // Challenge match
                groupedRequests.push({
                    type: 'challenge_match',
                    requestId: request._id,
                    requestIds: [request._id],
                    teamA: {
                        id: request.teamA._id,
                        name: request.teamA.teamName,
                        logo: request.teamA.teamLogo
                    },
                    teamB: {
                        name: ownerTeam.teamName,
                        logo: ownerTeam.teamLogo
                    },
                    groundName: request.groundId.groundName,
                    groundLocation: request.groundId.location,
                    date: formattedDate,
                    timeSlot: request.timeSlot,
                    matchType: request.matchType,
                    createdAt: request.createdAt,
                    status: 'ready_for_approval'
                });
                
                processedRequests.add(request._id.toString());
                
            } else if (request.matchType === 'guest_vs_guest') {
                
                // If teamB is already set (Merged/Paired Request)
                if (request.teamB) {
                     groupedRequests.push({
                        type: 'host_match_complete',
                        requestId: request._id,
                        requestIds: [request._id],
                        teamA: {
                            id: request.teamA._id,
                            name: request.teamA.teamName,
                            logo: request.teamA.teamLogo
                        },
                        teamB: {
                            id: request.teamB._id,
                            name: request.teamB.teamName,
                            logo: request.teamB.teamLogo
                        },
                        groundName: request.groundId.groundName,
                        groundLocation: request.groundId.location,
                        date: formattedDate,
                        timeSlot: request.timeSlot,
                        matchType: request.matchType,
                        createdAt: request.createdAt,
                        status: 'ready_for_approval'
                    });
                    processedRequests.add(request._id.toString());
                } else {
                    // Single Request - Waiting for Opponent
                    groupedRequests.push({
                        type: 'host_match_waiting',
                        requestId: request._id,
                        requestIds: [request._id],
                        teamA: {
                            id: request.teamA._id,
                            name: request.teamA.teamName,
                            logo: request.teamA.teamLogo
                        },
                        teamB: null,
                        groundName: request.groundId.groundName,
                        groundLocation: request.groundId.location,
                        date: formattedDate,
                        timeSlot: request.timeSlot,
                        matchType: request.matchType,
                        createdAt: request.createdAt,
                        status: 'waiting_for_opponent'
                    });
                    processedRequests.add(request._id.toString());
                }
            }
        }
        
        // Retrieve Confirmed Matches (for the tab)
        // Find requests that are 'approved' (booked)
        // Show matches from today onwards (including past matches from today)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        const confirmedRequests = await GuestMatchRequest.find({
            ownerTeamId: ownerTeam._id,
            status: 'approved',
            requestedDate: { $gte: today } // From today onwards
        })
        .populate('groundId', 'groundName location')
        .populate('teamA', 'teamName teamLogo')
        .populate('teamB', 'teamName teamLogo')
        .sort({ requestedDate: 1 });

        const confirmedMatches = confirmedRequests.map(match => {
             const formattedDate = match.requestedDate.toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            
            let type = 'regular_booking';
            if (match.matchType === 'vs_owner') type = 'challenge_match';
            else if (match.matchType === 'guest_vs_guest') type = 'host_match';

            return {
                type,
                matchId: match._id,
                teamA: {
                    id: match.teamA._id,
                    name: match.teamA.teamName,
                    logo: match.teamA.teamLogo
                },
                teamB: match.teamB ? {
                    id: match.teamB._id,
                    name: match.teamB.teamName,
                    logo: match.teamB.teamLogo
                } : null,
                groundName: match.groundId.groundName,
                groundLocation: match.groundId.location,
                date: formattedDate,
                timeSlot: match.timeSlot,
                status: 'confirmed'
            };
        });
        
        res.status(200).json({
            success: true,
            message: 'Pending guest match requests retrieved successfully.',
            pendingRequests: groupedRequests,
            confirmedMatches: confirmedMatches
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

// Get user's bookings (bookings made by the user's teams)
const getMyGuestRequests = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find all teams where user is either creator or member
        const userTeams = await Team.find({
            $or: [
                { createdBy: userId },
                { members: userId }
            ]
        }).select('_id teamName');

        if (userTeams.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No teams found for this user',
                bookings: []
            });
        }

        // Get team IDs
        const teamIds = userTeams.map(team => team._id);

        // Find all bookings made by user's teams
        const bookings = await GuestMatchRequest.find({
            $or: [
                { teamA: { $in: teamIds } },
                { teamB: { $in: teamIds } }
            ]
        })
        .populate({
            path: 'groundId',
            select: 'groundName location fee groundMaplink image ownedByTeam',
            populate: {
                path: 'ownedByTeam',
                select: 'teamName teamLogo'
            }
        })
        .populate('teamA', 'teamName teamLogo')
        .populate('teamB', 'teamName teamLogo') 
        .sort({ requestedDate: -1 }); // Most recent first

        // Format the response
        const formattedBookings = bookings.map(booking => {
            const formattedDate = booking.requestedDate.toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            // Determine match description based on booking type
            let matchDescription = '';
            let matchType = booking.matchType || 'regular';
            
            // Map matchType to old availabilityMode names for frontend compatibility if needed,
            // or just use matchType logic.
            // Backend uses: 'vs_owner', 'guest_vs_guest'
            // Frontend expects: 'owner_play', 'host_only' (legacy) OR adapt to new values.
            
            // Let's normalize for Frontend compatibility:
            let availabilityMode = 'regular';
            if (matchType === 'vs_owner') availabilityMode = 'owner_play';
            else if (matchType === 'guest_vs_guest') availabilityMode = 'host_only';

            if (matchType === 'vs_owner') {
                matchDescription = `${booking.teamA?.teamName} vs ${booking.groundId?.ownedByTeam?.teamName || 'Ground Owner'}`;
            } else if (matchType === 'guest_vs_guest' && booking.teamB) {
                matchDescription = `${booking.teamA?.teamName} vs ${booking.teamB?.teamName}`;
            } else {
                matchDescription = `${booking.teamA?.teamName} (Waiting for Opponent)`;
            }

            // Map status 'approved' -> 'booked' for frontend compatibility
            let status = booking.status;
            if (status === 'approved') status = 'booked';

            return {
                bookingId: booking._id,
                groundName: booking.groundId?.groundName || 'Unknown Ground',
                groundLocation: booking.groundId?.location || 'Unknown Location',
                groundImage: booking.groundId?.image || null,
                groundOwner: booking.groundId?.ownedByTeam?.teamName || 'Unknown Owner',
                groundOwnerLogo: booking.groundId?.ownedByTeam?.teamLogo || null,
                teamName: booking.teamA?.teamName || 'Unknown Team',
                teamLogo: booking.teamA?.teamLogo || null,
                opponentTeam: booking.teamB ? {
                    name: booking.teamB.teamName,
                    logo: booking.teamB.teamLogo
                } : null,
                bookedDate: formattedDate, // Frontend expects 'bookedDate' string
                timeSlot: booking.timeSlot,
                status: status,
                fee: booking.matchFee || 0,
                groundMaplink: booking.groundId?.groundMaplink || null,
                createdAt: booking.createdAt,
                responseNote: booking.responseNote,
                
                // Enhanced fields
                matchType: availabilityMode, // Send 'owner_play'/'host_only'
                matchDescription: matchDescription,
                isChallenge: matchType === 'vs_owner',
                isHosting: matchType === 'guest_vs_guest',
                // Status styling helper
                statusColor: status === 'booked' ? 'green' : 
                           status === 'rejected' ? 'red' : 'orange'
            };
        });

        res.status(200).json({
            success: true,
            message: 'User bookings retrieved successfully',
            bookings: formattedBookings,
            totalBookings: formattedBookings.length
        });

    } catch (error) {
        console.error('Error fetching user bookings:', error);
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
    getPendingGuestRequests,
    getMyGuestRequests
};