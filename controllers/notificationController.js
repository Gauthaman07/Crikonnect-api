const User = require('../models/User');
const { sendPushNotification, sendMultipleNotifications } = require('../services/notificationService');

/**
 * Register FCM token for a user
 * @route POST /api/notifications/register-token
 * @access Private
 */
exports.registerFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    
    if (!fcmToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'FCM token is required' 
      });
    }
    
    // Update user with the new FCM token
    await User.findByIdAndUpdate(
      req.user.id,
      { fcmToken: fcmToken },
      { new: true }
    );
    
    return res.status(200).json({
      success: true,
      message: 'FCM token registered successfully'
    });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register FCM token',
      error: error.message
    });
  }
};

/**
 * Unregister FCM token for a user
 * @route DELETE /api/notifications/unregister-token
 * @access Private
 */
exports.unregisterFCMToken = async (req, res) => {
  try {
    // Remove FCM token from user
    await User.findByIdAndUpdate(
      req.user.id,
      { fcmToken: null },
      { new: true }
    );
    
    return res.status(200).json({
      success: true,
      message: 'FCM token unregistered successfully'
    });
  } catch (error) {
    console.error('Error unregistering FCM token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unregister FCM token',
      error: error.message
    });
  }
};

/**
 * Send a manual notification to specific users
 * @route POST /api/notifications/send
 * @access Private (admin only)
 */
exports.sendManualNotification = async (req, res) => {
  try {
    const { userIds, title, body, data } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs are required (array)'
      });
    }
    
    if (!title || !body) {
      return res.status(400).json({
        success: false, 
        message: 'Notification title and body are required'
      });
    }
    
    // For multiple users
    if (userIds.length > 1) {
      const result = await sendMultipleNotifications(
        userIds,
        { title, body },
        data || {}
      );
      
      return res.status(200).json({
        success: true,
        message: `Sent ${result.success} notifications, failed: ${result.failure}`,
        result
      });
    } 
    // For a single user
    else {
      const success = await sendPushNotification(
        userIds[0],
        { title, body },
        data || {}
      );
      
      return res.status(success ? 200 : 400).json({
        success: success,
        message: success ? 'Notification sent successfully' : 'Failed to send notification'
      });
    }
  } catch (error) {
    console.error('Error sending manual notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message
    });
  }
}; 