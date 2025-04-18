const admin = require('firebase-admin');
const User = require('../models/User');

// Initialize Firebase Admin SDK
try {
    // Check if Firebase is already initialized
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
        });
    }
    console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
}

/**
 * Send push notification to a user
 * @param {string} userId - User ID to send notification to
 * @param {object} notification - Notification data object
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {object} data - Additional data to send with notification
 * @returns {Promise} - Result of the send operation
 */
const sendPushNotification = async (userId, notification, data = {}) => {
    try {
        // Find user by ID and get FCM token
        const user = await User.findById(userId);
        
        // If user doesn't exist or doesn't have FCM token
        if (!user || !user.fcmToken) {
            console.log(`No valid FCM token found for user ${userId}`);
            return { success: false, message: 'No valid FCM token found for user' };
        }

        const message = {
            notification,
            data,
            token: user.fcmToken
        };

        // Send message
        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification:', response);
        return { success: true, message: 'Notification sent successfully', response };
    } catch (error) {
        console.error('Error sending notification:', error);
        return { success: false, message: error.message };
    }
};

/**
 * Send notification to multiple users
 * @param {Array} userIds - Array of user IDs
 * @param {object} notification - Notification object
 * @param {object} data - Additional data
 * @returns {Promise} - Results of the send operations
 */
const sendMulticastNotification = async (userIds, notification, data = {}) => {
    try {
        // Get FCM tokens for all users
        const users = await User.find({ _id: { $in: userIds } });
        const tokens = users.filter(user => user.fcmToken).map(user => user.fcmToken);
        
        if (tokens.length === 0) {
            return { success: false, message: 'No valid FCM tokens found' };
        }

        const message = {
            notification,
            data,
            tokens
        };

        // Send multicast message
        const response = await admin.messaging().sendMulticast(message);
        console.log(`${response.successCount} messages were sent successfully`);
        
        return {
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount,
            responses: response.responses
        };
    } catch (error) {
        console.error('Error sending multicast notification:', error);
        return { success: false, message: error.message };
    }
};

module.exports = {
    sendPushNotification,
    sendMulticastNotification
}; 