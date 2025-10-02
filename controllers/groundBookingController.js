const GroundBooking = require('../models/groundBooking');
const WeeklyAvailability = require('../models/weeklyAvailability');
const Ground = require('../models/ground');
const Team = require('../models/team');
const User = require('../models/User');
const transporter = require('../config/emailConfig');
const axios = require('axios');
const { sendPushNotification } = require('../services/notificationService');

// Helper function to get Monday of the week
const getMondayOfWeek = (date) => {
    const inputDate = new Date(date); // Create a copy to avoid mutating original
    const day = inputDate.getDay();
    const diff = inputDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(inputDate.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

exports.bookGround = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { groundId, bookedDate, timeSlot, bookedByTeam, opponentTeam } = req.body;
        const userId = req.user.id;

        // Validation checks for required fields
        if (!groundId || !bookedDate || !timeSlot || !bookedByTeam) {
            return res.status(400).json({ message: 'Required fields are missing.' });
        }

        // Check if ground exists
        const ground = await Ground.findById(groundId);
        if (!ground) {
            return res.status(404).json({ message: 'Ground not found.' });
        }

        // Verify the team exists and user is part of it
        const team = await Team.findOne({
            _id: bookedByTeam,
            $or: [
                { createdBy: userId },
                { members: userId }
            ]
        });

        if (!team) {
            return res.status(403).json({
                message: 'You must be a member or owner of the team to make a booking.'
            });
        }

        // Check weekly availability if it exists
        // Fix date parsing to ensure correct date interpretation
        const requestedDateObj = new Date(bookedDate + 'T00:00:00.000Z');
        const monday = getMondayOfWeek(new Date(requestedDateObj));
        let availabilityMode = 'regular'; // Default for slots without weekly availability
        let weeklyAvailabilityRef = null;

        console.log('🔍 BOOKING DEBUG:');
        console.log('   📅 Requested Date:', bookedDate);
        console.log('   📅 Parsed Date Obj:', requestedDateObj);
        console.log('   📅 Calculated Monday:', monday);
        console.log('   🏟️ Ground ID:', groundId);

        const weeklyAvailability = await WeeklyAvailability.findOne({
            groundId: groundId,
            weekStartDate: monday
        }).populate('ownerTeamId');

        console.log('   📋 Weekly Availability Found:', weeklyAvailability ? 'YES' : 'NO');
        
        if (weeklyAvailability) {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayName = dayNames[requestedDateObj.getDay()];
            const slot = weeklyAvailability.schedule[dayName][timeSlot];
            
            console.log('   📅 Day Name:', dayName);
            console.log('   ⏰ Time Slot:', timeSlot);
            console.log('   🎯 Slot Data:', slot);
            console.log('   🎯 Slot Mode:', slot?.mode);
            
            availabilityMode = slot.mode;
            weeklyAvailabilityRef = weeklyAvailability._id;
            
            console.log('   ✅ Final Availability Mode:', availabilityMode);
            
            // Check availability mode rules
            if (slot.mode === 'unavailable') {
                // Regular booking mode - existing logic applies
                availabilityMode = 'regular';
            } else if (slot.mode === 'owner_play') {
                // Owner team vs guest team mode
                availabilityMode = 'owner_play';
                if (opponentTeam && opponentTeam !== 'null') {
                    return res.status(400).json({
                        message: 'For owner_play mode, you will play against the ground owner team. No opponent team needed.'
                    });
                }
                // Verify the requesting team is not the owner team
                if (bookedByTeam === weeklyAvailability.ownerTeamId._id.toString()) {
                    return res.status(400).json({
                        message: 'Owner team cannot book their own ground in owner_play mode.'
                    });
                }
            } else if (slot.mode === 'host_only') {
                // Guest team vs guest team mode
                availabilityMode = 'host_only';
                // Allow booking without opponent team - they'll be matched when ground owner approves
                if (opponentTeam && opponentTeam !== 'null') {
                    // Verify opponent team exists if specified
                    const opponent = await Team.findById(opponentTeam);
                    if (!opponent) {
                        return res.status(404).json({
                            message: 'Opponent team not found.'
                        });
                    }
                    // Verify teams are different
                    if (bookedByTeam === opponentTeam) {
                        return res.status(400).json({
                            message: 'Booking team and opponent team must be different.'
                        });
                    }
                    // Verify opponent team is not the owner team
                    if (opponentTeam === weeklyAvailability.ownerTeamId._id.toString()) {
                        return res.status(400).json({
                            message: 'Owner team cannot participate in host_only matches.'
                        });
                    }
                }
                // Verify requesting team is not the owner team
                if (bookedByTeam === weeklyAvailability.ownerTeamId._id.toString()) {
                    return res.status(400).json({
                        message: 'Owner team cannot participate in host_only matches.'
                    });
                }
            }
        }

        // Check if the time slot is already booked (different logic for host_only mode)
        if (availabilityMode === 'host_only') {
            // For host_only mode, check if there are already 2 bookings (since 2 teams should play)
            const existingBookings = await GroundBooking.find({
                groundId,
                bookedDate,
                timeSlot,
                status: { $in: ['pending', 'booked'] },
                availabilityMode: 'host_only'
            });

            if (existingBookings.length >= 2) {
                return res.status(400).json({
                    message: 'This time slot already has 2 teams booked for host-only match.'
                });
            }

            // Check if this team has already booked this slot
            const teamAlreadyBooked = existingBookings.find(booking => 
                booking.bookedByTeam.toString() === bookedByTeam.toString()
            );
            if (teamAlreadyBooked) {
                return res.status(400).json({
                    message: 'Your team has already booked this time slot.'
                });
            }

            // Check if opponent team has already booked this slot with a different opponent
            const opponentAlreadyBooked = existingBookings.find(booking => 
                booking.opponentTeam && booking.opponentTeam.toString() === opponentTeam.toString()
            );
            if (opponentAlreadyBooked) {
                return res.status(400).json({
                    message: 'The opponent team is already booked in this slot with another team.'
                });
            }

        } else {
            // For regular and owner_play modes, only one booking allowed per slot
            const existingBooking = await GroundBooking.findOne({
                groundId,
                bookedDate,
                timeSlot,
                status: { $in: ['pending', 'booked'] }
            });

            if (existingBooking) {
                return res.status(400).json({
                    message: 'This time slot is already booked or pending.'
                });
            }
        }

        // Create new booking
        const newBooking = new GroundBooking({
            groundId,
            bookedByTeam,
            bookedDate,
            timeSlot,
            status: 'pending',
            opponentTeam: opponentTeam && opponentTeam !== 'null' ? opponentTeam : null,
            availabilityMode,
            weeklyAvailabilityRef
        });

        const savedBooking = await newBooking.save();

        // Get ground owner's details for email and WhatsApp
        const groundOwner = await User.findById(ground.createdBy);

        // Format date for notifications
        const formattedDate = new Date(bookedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Prepare notification content based on booking type
        let notificationTitle, notificationBody, matchDescription;
        
        if (availabilityMode === 'owner_play') {
            notificationTitle = 'Challenge Request';
            notificationBody = `${team.teamName} wants to challenge your team at ${ground.groundName} on ${formattedDate} ${timeSlot}`;
            matchDescription = `Match: ${team.teamName} vs Your Team`;
        } else if (availabilityMode === 'host_only') {
            const opponent = await Team.findById(opponentTeam);
            notificationTitle = 'Match Hosting Request';
            notificationBody = `${team.teamName} vs ${opponent?.teamName || 'Unknown Team'} wants to play at ${ground.groundName} on ${formattedDate} ${timeSlot}`;
            matchDescription = `Match: ${team.teamName} vs ${opponent?.teamName || 'Unknown Team'}`;
        } else {
            notificationTitle = 'Ground Booking Request';
            notificationBody = `${team.teamName} has requested to book ${ground.groundName} on ${formattedDate} for ${timeSlot}`;
            matchDescription = `Booking: ${team.teamName}`;
        }

        // Send push notification to ground owner
        console.log('🏏 Ground Booking - Preparing push notification');
        console.log('   📋 Notification Details:');
        console.log('      Ground Owner ID:', ground.createdBy);
        console.log('      Ground Owner Name:', groundOwner?.name || groundOwner?.email);
        console.log('      Match Type:', availabilityMode);
        console.log('      Description:', matchDescription);
        console.log('      Ground Name:', ground.groundName);
        console.log('      Date:', formattedDate);
        console.log('      Time Slot:', timeSlot);

        try {
            // Additional data to send with notification
            const notificationData = {
                bookingId: savedBooking._id.toString(),
                teamId: team._id.toString(),
                teamName: team.teamName,
                groundId: ground._id.toString(),
                groundName: ground.groundName,
                date: formattedDate,
                timeSlot: timeSlot,
                availabilityMode: availabilityMode,
                opponentTeam: opponentTeam ? opponentTeam.toString() : '',
                type: 'new_booking_request'
            };

            console.log('📤 Ground Booking - Calling notification service...');

            // Send push notification to ground owner
            const notificationResult = await sendPushNotification(
                groundOwner._id,
                { title: notificationTitle, body: notificationBody },
                notificationData
            );

            if (notificationResult) {
                console.log('🎉 Ground Booking - Push notification sent successfully to ground owner');
                console.log('   ✅ Notification delivered to:', groundOwner.name || groundOwner.email);
            } else {
                console.log('⚠️ Ground Booking - Push notification failed but continuing with booking');
            }
        } catch (pushError) {
            console.error('💥 Ground Booking - Push notification error:');
            console.error('   📛 Error:', pushError.message);
            console.error('   🔍 Full Error:', pushError);
            console.log('   ➡️ Continuing with booking despite notification failure');
        }

        // Send email notification
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: groundOwner.email,
                subject: notificationTitle,
                html: `
                    <h2>${notificationTitle}</h2>
                    <p>You have received a new request for your ground.</p>
                    <h3>Request Details:</h3>
                    <ul>
                        <li><strong>Match Type:</strong> ${matchDescription}</li>
                        <li><strong>Date:</strong> ${formattedDate}</li>
                        <li><strong>Time Slot:</strong> ${timeSlot}</li>
                        <li><strong>Ground:</strong> ${ground.groundName}</li>
                        <li><strong>Booking Mode:</strong> ${availabilityMode.replace('_', ' ').toUpperCase()}</li>
                    </ul>
                    ${availabilityMode === 'owner_play' ?
                        '<p><strong>Note:</strong> This is a challenge match against your team!</p>' :
                        availabilityMode === 'host_only' ?
                        '<p><strong>Note:</strong> You will host this match between two guest teams.</p>' :
                        '<p><strong>Note:</strong> This is a regular ground booking.</p>'
                    }
                    <p>Please log in to your account to approve or reject this request.</p>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log('✅ Email notification sent successfully');
        } catch (emailError) {
            console.error('⚠️ Email notification failed but continuing with booking:', emailError.message);
        }

        console.log('GUPSHUP_API_KEY:', process.env.GUPSHUP_API_KEY);
        console.log('GUPSHUP_SOURCE_NUMBER:', process.env.GUPSHUP_SOURCE_NUMBER);
        // Send WhatsApp notification using Gupshup
        try {
            const gupshupResponse = await axios.post(
                'https://api.gupshup.io/wa/api/v1/template/msg',
                new URLSearchParams({
                    apiKey: process.env.GUPSHUP_API_KEY,
                    source: process.env.GUPSHUP_SOURCE_NUMBER,
                    destination: `+91${groundOwner.mobile}`,
                    templateId: "ground_booking_request",  // Make sure this ID is correct
                    params: JSON.stringify([
                        groundOwner.name,
                        team.teamName,
                        ground.groundName,
                        formattedDate,
                        timeSlot
                    ])
                }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            console.log('WhatsApp template message sent successfully:', gupshupResponse.data);
        } catch (error) {
            console.error('Failed to send WhatsApp template message:', error.response?.data || error.message);
        }


        res.status(201).json({
            success: true,
            message: 'Booking request created successfully. Notifications sent.',
            booking: savedBooking
        });
    } catch (error) {
        console.error('Error in booking process:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};



// Add this to your existing groundBookingController.js
exports.updateBookingStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body; // 'booked' or 'rejected'
        const userId = req.user.id;

        // Validate status
        if (!['booked', 'rejected'].includes(status)) {
            return res.status(400).json({
                message: 'Invalid status. Must be either "booked" or "rejected".'
            });
        }

        // Find the booking
        const booking = await GroundBooking.findById(bookingId)
            .populate('groundId')
            .populate('bookedByTeam');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        // Verify that the user owns the ground
        const userTeam = await Team.findOne({
            createdBy: userId,
            groundId: booking.groundId._id
        });

        if (!userTeam) {
            return res.status(403).json({
                message: 'Only the ground owner can approve or reject bookings.'
            });
        }

        // Update booking status
        booking.status = status;
        await booking.save();

        // Find the team that requested the booking to get their details
        const requestingTeam = await Team.findById(booking.bookedByTeam._id)
            .populate('createdBy', 'email _id'); // Get team creator's email and ID

        // Format date for email
        const formattedDate = new Date(booking.bookedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Send push notification
        try {
            const notificationTitle = `Ground Booking ${status === 'booked' ? 'Accepted' : 'Rejected'}`;
            const notificationBody = `Your booking request for ${booking.groundId.groundName} on ${formattedDate} has been ${status === 'booked' ? 'accepted' : 'rejected'}.`;

            // Additional data to send with notification
            const notificationData = {
                bookingId: booking._id.toString(),
                groundId: booking.groundId._id.toString(),
                groundName: booking.groundId.groundName,
                date: formattedDate,
                timeSlot: booking.timeSlot,
                status: status,
                type: 'booking_update'
            };

            // Send push notification to the team creator
            await sendPushNotification(
                requestingTeam.createdBy._id,
                { title: notificationTitle, body: notificationBody },
                notificationData
            );

            console.log('Push notification sent successfully');
        } catch (pushError) {
            console.error('Error sending push notification:', pushError);
        }

        // Send email notification
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: requestingTeam.createdBy.email,
                subject: `Ground Booking ${status === 'booked' ? 'Accepted' : 'Rejected'}`,
                html: `
                    <h2>Booking ${status === 'booked' ? 'Accepted' : 'Rejected'}</h2>
                    <p>Your ground booking request has been ${status === 'booked' ? 'accepted' : 'rejected'}.</p>
                    <h3>Booking Details:</h3>
                    <ul>
                        <li><strong>Ground:</strong> ${booking.groundId.groundName}</li>
                        <li><strong>Date:</strong> ${formattedDate}</li>
                        <li><strong>Time Slot:</strong> ${booking.timeSlot}</li>
                        ${status === 'booked' ? `
                        <li><strong>Fee:</strong> ${booking.groundId.fee}</li>
                        <li><strong>Location:</strong> ${booking.groundId.location}</li>
                        <li><strong>Ground Map Link:</strong> <a href="${booking.groundId.groundMaplink}">Click here</a></li>
                        ` : ''}
                    </ul>
                    ${status === 'booked' ?
                        '<p>Please arrive on time and follow all ground rules.</p>' :
                        '<p>Please try booking another available slot or ground.</p>'
                    }
                `
            };

            await transporter.sendMail(mailOptions);

            // Send WhatsApp notification for booking status update
            try {
                const templateId = status === 'booked' ? 'booking_accepted' : 'booking_rejected';
                const whatsappParams = status === 'booked' 
                    ? [
                        requestingTeam.createdBy.name,
                        booking.groundId.groundName,
                        formattedDate,
                        booking.timeSlot,
                        booking.groundId.fee,
                        booking.groundId.location
                    ]
                    : [
                        requestingTeam.createdBy.name,
                        booking.groundId.groundName,
                        formattedDate,
                        booking.timeSlot
                    ];

                const gupshupResponse = await axios.post(
                    'https://api.gupshup.io/wa/api/v1/template/msg',
                    new URLSearchParams({
                        apiKey: process.env.GUPSHUP_API_KEY,
                        source: process.env.GUPSHUP_SOURCE_NUMBER,
                        destination: `+91${requestingTeam.createdBy.mobile}`,
                        templateId: templateId,
                        params: JSON.stringify(whatsappParams)
                    }).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                console.log('WhatsApp booking status notification sent successfully:', gupshupResponse.data);
            } catch (whatsappError) {
                console.error('Failed to send WhatsApp booking status notification:', whatsappError.response?.data || whatsappError.message);
            }

            res.status(200).json({
                success: true,
                message: `Booking ${status === 'booked' ? 'accepted' : 'rejected'} successfully and notifications sent.`,
                booking
            });

        } catch (emailError) {
            console.error('Email sending error:', emailError);
            res.status(200).json({
                success: true,
                message: `Booking ${status === 'booked' ? 'accepted' : 'rejected'} successfully but email notification failed.`,
                booking,
                emailError: emailError.message
            });
        }

    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get user's bookings (bookings made by the user's teams)
exports.getUserBookings = async (req, res) => {
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
        const bookings = await GroundBooking.find({
            bookedByTeam: { $in: teamIds }
        })
        .populate({
            path: 'groundId',
            select: 'groundName location fee groundMaplink image ownedByTeam',
            populate: {
                path: 'ownedByTeam',
                select: 'teamName'
            }
        })
        .populate('bookedByTeam', 'teamName teamLogo')
        .populate('opponentTeam', 'teamName teamLogo') // Populate opponent team info
        .sort({ createdAt: -1 }); // Most recent first

        // Format the response
        const formattedBookings = bookings.map(booking => {
            const formattedDate = new Date(booking.bookedDate).toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            // Determine match description based on booking type
            let matchDescription = '';
            let matchType = booking.availabilityMode || 'regular';
            
            if (matchType === 'owner_play') {
                matchDescription = `${booking.bookedByTeam?.teamName} vs ${booking.groundId?.ownedByTeam?.teamName || 'Ground Owner'}`;
            } else if (matchType === 'host_only' && booking.opponentTeam) {
                matchDescription = `${booking.bookedByTeam?.teamName} vs ${booking.opponentTeam?.teamName}`;
            } else {
                matchDescription = `${booking.bookedByTeam?.teamName} (Regular Booking)`;
            }

            return {
                bookingId: booking._id,
                groundName: booking.groundId?.groundName || 'Unknown Ground',
                groundLocation: booking.groundId?.location || 'Unknown Location',
                groundImage: booking.groundId?.image || null,
                groundOwner: booking.groundId?.ownedByTeam?.teamName || 'Unknown Owner',
                teamName: booking.bookedByTeam?.teamName || 'Unknown Team',
                teamLogo: booking.bookedByTeam?.teamLogo || null,
                opponentTeam: booking.opponentTeam ? {
                    name: booking.opponentTeam.teamName,
                    logo: booking.opponentTeam.teamLogo
                } : null,
                bookedDate: formattedDate,
                timeSlot: booking.timeSlot,
                status: booking.status,
                fee: booking.groundId?.fee || 0,
                groundMaplink: booking.groundId?.groundMaplink || null,
                createdAt: booking.createdAt,
                // Enhanced fields
                matchType: matchType,
                matchDescription: matchDescription,
                isChallenge: matchType === 'owner_play',
                isHosting: matchType === 'host_only',
                // Status styling helper
                statusColor: booking.status === 'booked' ? 'green' : 
                           booking.status === 'rejected' ? 'red' : 'orange'
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

// Get pending ground booking requests with intelligent grouping
const getPendingGroundRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Find user's team that owns a ground
        const ownerTeam = await Team.findOne({ 
            createdBy: userId, 
            hasOwnGround: true 
        }).populate('groundId');
        
        if (!ownerTeam || !ownerTeam.groundId) {
            return res.status(404).json({ 
                message: 'No ground found for this user.' 
            });
        }
        
        console.log('🔍 PENDING REQUESTS DEBUG:');
        console.log('   👤 User ID:', userId);
        console.log('   🏟️ Owner Team:', ownerTeam.teamName);
        console.log('   🏟️ Ground ID:', ownerTeam.groundId._id);
        
        // Get all pending requests for this ground
        const pendingBookings = await GroundBooking.find({
            groundId: ownerTeam.groundId._id,
            status: 'pending'
        })
        .populate('bookedByTeam', 'teamName teamLogo')
        .populate('opponentTeam', 'teamName teamLogo')
        .sort({ bookedDate: 1, timeSlot: 1, createdAt: -1 });
        
        // Get all confirmed bookings for this ground
        const confirmedBookings = await GroundBooking.find({
            groundId: ownerTeam.groundId._id,
            status: 'booked',
            bookedDate: { $gte: new Date() } // Only future bookings
        })
        .populate('bookedByTeam', 'teamName teamLogo')
        .populate('opponentTeam', 'teamName teamLogo')
        .sort({ bookedDate: 1, timeSlot: 1 });
        
        console.log('   📋 Total Pending Bookings:', pendingBookings.length);
        console.log('   ✅ Total Confirmed Bookings:', confirmedBookings.length);
        
        // Group pending bookings intelligently
        const groupedRequests = [];
        const processedBookings = new Set();
        
        for (const booking of pendingBookings) {
            if (processedBookings.has(booking._id.toString())) {
                continue;
            }
            
            const bookingDateStr = booking.bookedDate.toISOString().split('T')[0];
            const formattedDate = booking.bookedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            console.log(`   🎯 Processing booking: ${booking.bookedByTeam.teamName} - ${booking.availabilityMode} - ${formattedDate} ${booking.timeSlot}`);
            
            if (booking.availabilityMode === 'owner_play') {
                // Challenge match - single booking
                groupedRequests.push({
                    type: 'challenge_match',
                    requestId: booking._id,
                    requestIds: [booking._id],
                    teamA: {
                        id: booking.bookedByTeam._id,
                        name: booking.bookedByTeam.teamName,
                        logo: booking.bookedByTeam.teamLogo
                    },
                    teamB: {
                        name: 'Your Team',
                        logo: ownerTeam.teamLogo
                    },
                    groundName: ownerTeam.groundId.groundName,
                    groundLocation: ownerTeam.groundId.location,
                    date: formattedDate,
                    timeSlot: booking.timeSlot,
                    availabilityMode: booking.availabilityMode,
                    createdAt: booking.createdAt,
                    status: 'ready_for_approval'
                });
                
                processedBookings.add(booking._id.toString());
                console.log('   ✅ Added challenge match');
                
            } else if (booking.availabilityMode === 'host_only') {
                // Find if there's another host_only booking for same slot
                const matchingBooking = pendingBookings.find(otherBooking => 
                    otherBooking._id.toString() !== booking._id.toString() &&
                    !processedBookings.has(otherBooking._id.toString()) &&
                    otherBooking.availabilityMode === 'host_only' &&
                    otherBooking.bookedDate.toISOString().split('T')[0] === bookingDateStr &&
                    otherBooking.timeSlot === booking.timeSlot
                );
                
                if (matchingBooking) {
                    // Pair found - create host match group
                    groupedRequests.push({
                        type: 'host_match_complete',
                        groupId: `${booking._id}_${matchingBooking._id}`,
                        requestIds: [booking._id, matchingBooking._id],
                        teamA: {
                            id: booking.bookedByTeam._id,
                            name: booking.bookedByTeam.teamName,
                            logo: booking.bookedByTeam.teamLogo
                        },
                        teamB: {
                            id: matchingBooking.bookedByTeam._id,
                            name: matchingBooking.bookedByTeam.teamName,
                            logo: matchingBooking.bookedByTeam.teamLogo
                        },
                        groundName: ownerTeam.groundId.groundName,
                        groundLocation: ownerTeam.groundId.location,
                        date: formattedDate,
                        timeSlot: booking.timeSlot,
                        availabilityMode: booking.availabilityMode,
                        createdAt: booking.createdAt,
                        status: 'ready_for_approval'
                    });
                    
                    processedBookings.add(booking._id.toString());
                    processedBookings.add(matchingBooking._id.toString());
                    console.log(`   ✅ Added complete host match: ${booking.bookedByTeam.teamName} vs ${matchingBooking.bookedByTeam.teamName}`);
                    
                } else {
                    // Single host booking - waiting for opponent
                    groupedRequests.push({
                        type: 'host_match_waiting',
                        requestId: booking._id,
                        requestIds: [booking._id],
                        teamA: {
                            id: booking.bookedByTeam._id,
                            name: booking.bookedByTeam.teamName,
                            logo: booking.bookedByTeam.teamLogo
                        },
                        teamB: null,
                        groundName: ownerTeam.groundId.groundName,
                        groundLocation: ownerTeam.groundId.location,
                        date: formattedDate,
                        timeSlot: booking.timeSlot,
                        availabilityMode: booking.availabilityMode,
                        createdAt: booking.createdAt,
                        status: 'waiting_for_opponent'
                    });
                    
                    processedBookings.add(booking._id.toString());
                    console.log('   ⏳ Added waiting host match');
                }
                
            } else {
                // Regular booking
                groupedRequests.push({
                    type: 'regular_booking',
                    requestId: booking._id,
                    requestIds: [booking._id],
                    teamA: {
                        id: booking.bookedByTeam._id,
                        name: booking.bookedByTeam.teamName,
                        logo: booking.bookedByTeam.teamLogo
                    },
                    teamB: null,
                    groundName: ownerTeam.groundId.groundName,
                    groundLocation: ownerTeam.groundId.location,
                    date: formattedDate,
                    timeSlot: booking.timeSlot,
                    availabilityMode: booking.availabilityMode,
                    createdAt: booking.createdAt,
                    status: 'ready_for_approval'
                });
                
                processedBookings.add(booking._id.toString());
                console.log('   ✅ Added regular booking');
            }
        }
        
        // Sort by date and time
        groupedRequests.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateB - dateA; // Most recent first
        });
        
        console.log('   📊 Final grouped requests:', groupedRequests.length);
        
        // Process confirmed bookings with intelligent grouping
        const confirmedMatches = [];
        const processedConfirmedBookings = new Set();
        
        for (const booking of confirmedBookings) {
            if (processedConfirmedBookings.has(booking._id.toString())) {
                continue;
            }
            
            const formattedDate = booking.bookedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            if (booking.availabilityMode === 'owner_play') {
                // Challenge match - your team vs guest team
                confirmedMatches.push({
                    type: 'challenge_match',
                    matchId: booking._id,
                    teamA: {
                        name: 'Your Team',
                        logo: ownerTeam.teamLogo
                    },
                    teamB: {
                        id: booking.bookedByTeam._id,
                        name: booking.bookedByTeam.teamName,
                        logo: booking.bookedByTeam.teamLogo
                    },
                    groundName: ownerTeam.groundId.groundName,
                    groundLocation: ownerTeam.groundId.location,
                    date: formattedDate,
                    timeSlot: booking.timeSlot,
                    availabilityMode: booking.availabilityMode,
                    status: 'confirmed',
                    bookedDate: booking.bookedDate
                });
                processedConfirmedBookings.add(booking._id.toString());
                
            } else if (booking.availabilityMode === 'host_only') {
                // Find matching host_only booking for same date/time slot
                const bookingDateStr = booking.bookedDate.toISOString().split('T')[0];
                const matchingBooking = confirmedBookings.find(otherBooking => 
                    otherBooking._id.toString() !== booking._id.toString() &&
                    !processedConfirmedBookings.has(otherBooking._id.toString()) &&
                    otherBooking.availabilityMode === 'host_only' &&
                    otherBooking.bookedDate.toISOString().split('T')[0] === bookingDateStr &&
                    otherBooking.timeSlot === booking.timeSlot
                );
                
                if (matchingBooking) {
                    // Pair found - create combined host match
                    confirmedMatches.push({
                        type: 'host_match',
                        matchId: `${booking._id}_${matchingBooking._id}`,
                        teamA: {
                            id: booking.bookedByTeam._id,
                            name: booking.bookedByTeam.teamName,
                            logo: booking.bookedByTeam.teamLogo
                        },
                        teamB: {
                            id: matchingBooking.bookedByTeam._id,
                            name: matchingBooking.bookedByTeam.teamName,
                            logo: matchingBooking.bookedByTeam.teamLogo
                        },
                        groundName: ownerTeam.groundId.groundName,
                        groundLocation: ownerTeam.groundId.location,
                        date: formattedDate,
                        timeSlot: booking.timeSlot,
                        availabilityMode: booking.availabilityMode,
                        status: 'confirmed',
                        bookedDate: booking.bookedDate
                    });
                    processedConfirmedBookings.add(booking._id.toString());
                    processedConfirmedBookings.add(matchingBooking._id.toString());
                } else {
                    // Single host booking - no pair yet (shouldn't happen in normal flow)
                    confirmedMatches.push({
                        type: 'host_match_single',
                        matchId: booking._id,
                        teamA: {
                            id: booking.bookedByTeam._id,
                            name: booking.bookedByTeam.teamName,
                            logo: booking.bookedByTeam.teamLogo
                        },
                        teamB: null,
                        groundName: ownerTeam.groundId.groundName,
                        groundLocation: ownerTeam.groundId.location,
                        date: formattedDate,
                        timeSlot: booking.timeSlot,
                        availabilityMode: booking.availabilityMode,
                        status: 'confirmed',
                        bookedDate: booking.bookedDate
                    });
                    processedConfirmedBookings.add(booking._id.toString());
                }
                
            } else {
                // Regular booking
                confirmedMatches.push({
                    type: 'regular_booking',
                    matchId: booking._id,
                    teamA: {
                        id: booking.bookedByTeam._id,
                        name: booking.bookedByTeam.teamName,
                        logo: booking.bookedByTeam.teamLogo
                    },
                    teamB: null,
                    groundName: ownerTeam.groundId.groundName,
                    groundLocation: ownerTeam.groundId.location,
                    date: formattedDate,
                    timeSlot: booking.timeSlot,
                    availabilityMode: booking.availabilityMode,
                    status: 'confirmed',
                    bookedDate: booking.bookedDate
                });
                processedConfirmedBookings.add(booking._id.toString());
            }
        }
        
        // Sort confirmed matches by date
        confirmedMatches.sort((a, b) => new Date(a.bookedDate) - new Date(b.bookedDate));
        
        console.log('   🎯 Final confirmed matches:', confirmedMatches.length);
        
        res.status(200).json({
            success: true,
            message: 'Ground requests and matches retrieved successfully.',
            pendingRequests: groupedRequests,
            confirmedMatches: confirmedMatches,
            totalPendingRequests: groupedRequests.length,
            totalConfirmedMatches: confirmedMatches.length
        });
        
    } catch (error) {
        console.error('Error getting pending ground requests:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Respond to multiple ground booking requests (group approval/rejection)
const respondToGroundBookings = async (req, res) => {
    try {
        const userId = req.user.id;
        const { requestIds, status, responseNote } = req.body;
        
        if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
            return res.status(400).json({ 
                message: 'Request IDs array is required.' 
            });
        }
        
        if (!['approved', 'rejected', 'booked'].includes(status)) {
            return res.status(400).json({ 
                message: 'Status must be either "approved", "booked", or "rejected".' 
            });
        }
        
        // Convert "approved" and "booked" to "booked" for database storage
        const dbStatus = (status === 'approved' || status === 'booked') ? 'booked' : 'rejected';
        
        console.log('🔍 GROUP BOOKING RESPONSE DEBUG:');
        console.log('   👤 User ID:', userId);
        console.log('   📋 Request IDs:', requestIds);
        console.log('   ✅ Status:', status);
        console.log('   💬 Note:', responseNote);
        
        // Find user's team that owns a ground
        const ownerTeam = await Team.findOne({ 
            createdBy: userId, 
            hasOwnGround: true 
        }).populate('groundId');
        
        if (!ownerTeam || !ownerTeam.groundId) {
            return res.status(404).json({ 
                message: 'No ground found for this user.' 
            });
        }
        
        // Find all the booking requests
        const bookings = await GroundBooking.find({
            _id: { $in: requestIds },
            groundId: ownerTeam.groundId._id,
            status: 'pending'
        }).populate('bookedByTeam', 'teamName teamLogo createdBy')
         .populate('opponentTeam', 'teamName teamLogo createdBy');
        
        if (bookings.length === 0) {
            return res.status(404).json({ 
                message: 'No pending bookings found for the given request IDs.' 
            });
        }
        
        if (bookings.length !== requestIds.length) {
            return res.status(400).json({ 
                message: 'Some booking requests were not found or are not in pending status.' 
            });
        }
        
        console.log('   📊 Found bookings:', bookings.length);
        
        // Update all booking statuses
        const updateResults = [];
        const notificationPromises = [];
        
        for (const booking of bookings) {
            booking.status = dbStatus;
            booking.responseDate = new Date();
            booking.responseNote = responseNote || '';
            booking.respondedBy = userId;
            
            await booking.save();
            updateResults.push({
                bookingId: booking._id,
                teamName: booking.bookedByTeam.teamName,
                date: booking.bookedDate,
                timeSlot: booking.timeSlot,
                status: dbStatus
            });
            
            // Prepare notification for team owner
            const teamOwner = await User.findById(booking.bookedByTeam.createdBy);
            if (teamOwner) {
                const formattedDate = booking.bookedDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                
                let notificationTitle, notificationBody;
                if (booking.availabilityMode === 'owner_play') {
                    notificationTitle = `Challenge ${status === 'approved' ? 'Accepted' : 'Declined'}`;
                    notificationBody = status === 'approved' 
                        ? `Your challenge has been accepted! Match at ${ownerTeam.groundId.groundName} on ${formattedDate} ${booking.timeSlot}.`
                        : `Your challenge request has been declined.`;
                } else if (booking.availabilityMode === 'host_only') {
                    notificationTitle = `Host Match ${status === 'approved' ? 'Approved' : 'Rejected'}`;
                    notificationBody = status === 'approved'
                        ? `Your match has been approved! Playing at ${ownerTeam.groundId.groundName} on ${formattedDate} ${booking.timeSlot}.`
                        : `Your match request has been rejected.`;
                } else {
                    notificationTitle = `Booking ${status === 'approved' ? 'Confirmed' : 'Rejected'}`;
                    notificationBody = status === 'approved'
                        ? `Your ground booking has been confirmed for ${formattedDate} ${booking.timeSlot}.`
                        : `Your ground booking request has been rejected.`;
                }
                
                const notificationData = {
                    bookingId: booking._id.toString(),
                    groundId: ownerTeam.groundId._id.toString(),
                    groundName: ownerTeam.groundId.groundName,
                    date: formattedDate,
                    timeSlot: booking.timeSlot,
                    status: status,
                    availabilityMode: booking.availabilityMode,
                    type: 'booking_response'
                };
                
                // Add to notification promises
                notificationPromises.push(
                    sendPushNotification(
                        teamOwner._id,
                        { title: notificationTitle, body: notificationBody },
                        notificationData
                    ).catch(error => {
                        console.error(`Failed to send notification to ${teamOwner.name}:`, error);
                    })
                );
            }
        }
        
        // Send all notifications in parallel
        try {
            await Promise.allSettled(notificationPromises);
            console.log('   📤 Notifications sent to all teams');
        } catch (error) {
            console.error('   ❌ Error sending some notifications:', error);
        }
        
        res.status(200).json({
            success: true,
            message: `${bookings.length} booking request(s) ${status} successfully.`,
            results: updateResults,
            status: dbStatus,
            totalProcessed: bookings.length
        });
        
    } catch (error) {
        console.error('Error responding to ground bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    bookGround: exports.bookGround,
    updateBookingStatus: exports.updateBookingStatus,
    getUserBookings: exports.getUserBookings,
    getPendingGroundRequests,
    respondToGroundBookings
};