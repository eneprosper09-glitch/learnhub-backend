import express from 'express';
import * as c from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/', c.getMyNotifications);
router.put('/read-all', c.markAllRead);
router.put('/:id/read', c.markAsRead);
router.delete('/:id', c.deleteNotification);

export default router;