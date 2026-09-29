import Notification from '../models/Notification.js';

export const getMyNotifications = async (req, res, next) => {
  try {
    const data = await Notification.find({
      user: req.user._id,
      isDeleted: false,
    })
      .sort('-createdAt')
      .limit(50);

    const unread = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
      isDeleted: false,
    });

    res.json({ success: true, count: data.length, unread, data });
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const notif = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!notif) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Notification not found',
        requestId: req.id,
      });
    }
    notif.isRead = true;
    await notif.save();
    res.json({ success: true, data: notif });
  } catch (err) {
    next(err);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true }
    );
    res.json({ success: true, message: 'All marked as read' });
  } catch (err) {
    next(err);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const notif = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!notif) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Notification not found',
        requestId: req.id,
      });
    }
    notif.isDeleted = true;
    await notif.save();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};