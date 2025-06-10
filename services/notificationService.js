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
    // Log input parameters
    console.log('🚀 NotificationService - Starting push notification process');
    console.log('   📋 Input Parameters:');
    console.log('      User ID:', userId);
    console.log('      Title:', notification.title);
    console.log('      Body:', notification.body);
    console.log('      Data payload:', JSON.stringify(data, null, 2));

    // Find user and validate FCM token
    console.log('🔍 NotificationService - Looking up user...');
    const user = await User.findById(userId);
    
    if (!user) {
      console.error('❌ NotificationService - User not found with ID:', userId);
      return false;
    }

    console.log('✅ NotificationService - User found:', user.name || user.email);
    
    if (!user.fcmToken) {
      console.error('❌ NotificationService - No FCM token found for user:', userId);
      console.log('   User details:', {
        name: user.name,
        email: user.email,
        fcmToken: user.fcmToken
      });
      return false;
    }

    // Log FCM token (partial for security)
    console.log('🔑 NotificationService - FCM Token found:', user.fcmToken.substring(0, 20) + '...');

    // Prepare message
    const message = {
      token: user.fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data,
    };

    console.log('📤 NotificationService - Sending FCM message...');
    console.log('   Message payload:', JSON.stringify({
      token: user.fcmToken.substring(0, 20) + '...',
      notification: message.notification,
      data: message.data
    }, null, 2));

    // Send the notification
    const response = await admin.messaging().send(message);
    
    console.log('✅ NotificationService - FCM Success!');
    console.log('   📨 Response ID:', response);
    console.log('   📱 Sent to user:', user.name || user.email);
    console.log('   🎯 FCM Token (partial):', user.fcmToken.substring(0, 20) + '...');
    
    return true;
  } catch (err) {
    console.error('💥 NotificationService - FCM Error Details:');
    console.error('   📛 Error Code:', err.code);
    console.error('   📝 Error Message:', err.message);
    console.error('   🔍 Error Details:', err.details);
    console.error('   📊 Full Error Object:', err);
    
    // Log specific Firebase error codes
    if (err.code === 'messaging/invalid-registration-token') {
      console.error('   🚨 SPECIFIC ERROR: Invalid or expired FCM token');
    } else if (err.code === 'messaging/registration-token-not-registered') {
      console.error('   🚨 SPECIFIC ERROR: FCM token not registered');
    } else if (err.code === 'app/invalid-credential') {
      console.error('   🚨 SPECIFIC ERROR: Firebase credentials issue');
    }
    
    return false;
  }
};

module.exports = { sendPushNotification };
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