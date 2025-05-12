const admin = require('firebase-admin');
const User = require('../models/User');


/**
 * Send a push notification to a single user
 * @param {string} userId - User ID
 * @param {Object} notification - Object containing title and body
 * @param {Object} data - Additional data to send with notification
 * @returns {Promise<boolean>} - Whether the notification was sent successfully
 */
const sendPushNotification = async (userId, notification, data = {}) => {
  try {
    // Initialize Firebase Admin
    const firebaseAdmin = initializeFirebaseAdmin();
    
    // Find user by ID to get FCM token
    const user = await User.findById(userId);
    
    // If user not found or has no FCM token, return false
    if (!user || !user.fcmToken) {
      console.log(`No valid FCM token found for user ${userId}`);
      return false;
    }
    
    // Prepare notification message
    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: data,
      token: user.fcmToken
    };
    
    // Send notification
    const response = await firebaseAdmin.messaging().send(message);
    console.log('Successfully sent notification:', response);
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
};

/**
 * Send push notifications to multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Object} notification - Object containing title and body
 * @param {Object} data - Additional data to send with notification
 * @returns {Promise<{success: number, failure: number}>} - Count of successful and failed notifications
 */
const sendMultipleNotifications = async (userIds, notification, data = {}) => {
  try {
    // Initialize Firebase Admin
    const firebaseAdmin = initializeFirebaseAdmin();
    
    // Get FCM tokens for all specified users
    const users = await User.find({ _id: { $in: userIds } });
    
    // Filter users with valid FCM tokens
    const validTokens = users
      .filter(user => user && user.fcmToken)
      .map(user => user.fcmToken);
    
    if (validTokens.length === 0) {
      console.log('No valid FCM tokens found');
      return { success: 0, failure: userIds.length };
    }
    
    // Prepare notification message
    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: data,
      tokens: validTokens
    };
    
    // Send notifications
    const response = await firebaseAdmin.messaging().sendMulticast(message);
    console.log(`Successfully sent ${response.successCount} notifications, failed: ${response.failureCount}`);
    
    return {
      success: response.successCount,
      failure: response.failureCount
    };
  } catch (error) {
    console.error('Error sending multiple push notifications:', error);
    return { success: 0, failure: userIds.length };
  }
};

module.exports = {
  sendPushNotification,
  sendMultipleNotifications
};