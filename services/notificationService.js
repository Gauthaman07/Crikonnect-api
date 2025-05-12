const admin = require('../config/firebase');
const User = require('../models/User');

/**
 * Send push notification to a specific user
 * @param {string} userId - The ID of the user to send notification to
 * @param {object} notification - The notification object with title and body
 * @param {object} data - Additional data payload for the notification
 * @returns {Promise<boolean>} - Whether notification was sent successfully
 */
const sendPushNotification = async (userId, notification, data = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) {
      console.log(`User not found or no FCM token`);
      return false;
    }

    const message = {
      token: user.fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data,
    };

    await admin.messaging().send(message);
    console.log('Push notification sent to:', user.fcmToken);
    return true;
  } catch (err) {
    console.error('FCM send error:', err);
    return false;
  }
};

/**
 * Send push notification to multiple users
 * @param {string[]} userIds - Array of user IDs to send notification to
 * @param {object} notification - The notification object with title and body
 * @param {object} data - Additional data payload for the notification
 * @returns {Promise<object>} - Results of the sending operation
 */
exports.sendMultipleNotifications = async (userIds, notification, data = {}) => {
  try {
    // Get users with FCM tokens
    const users = await User.find({
      _id: { $in: userIds },
      fcmToken: { $ne: null }
    });
    
    if (users.length === 0) {
      console.log('No users with FCM tokens found');
      return { success: 0, failure: userIds.length };
    }
    
    // Convert all data values to strings (FCM requirement)
    const stringifiedData = {};
    Object.keys(data).forEach(key => {
      stringifiedData[key] = String(data[key]);
    });
    
    const tokens = users.map(user => user.fcmToken);
    
    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: stringifiedData,
      tokens: tokens
    };
    
    const response = await admin.messaging().sendMulticast(message);
    console.log(`Successfully sent ${response.successCount} notifications, failed: ${response.failureCount}`);
    
    return {
      success: response.successCount,
      failure: response.failureCount
    };
  } catch (error) {
    console.error('Error sending multiple notifications:', error);
    return { success: 0, failure: userIds.length, error: error.message };
  }
};