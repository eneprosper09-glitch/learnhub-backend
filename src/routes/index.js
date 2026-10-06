import { Router } from 'express';

import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import courseRoutes from './courseRoutes.js';
import lessonRoutes from './lessonRoutes.js';
import enrollmentRoutes from './enrollmentRoutes.js';
import progressRoutes from './progressRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import reviewRoutes from './reviewRoutes.js';
import sectionRoutes from './sectionRoutes.js';
import announcementRoutes from './announcementRoutes.js';
import certificateRoutes from './certificateRoutes.js';
import noteRoutes from './noteRoutes.js';
import bookmarkRoutes from './bookmarkRoutes.js';
import questionRoutes from './questionRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import conversationRoutes from './conversationRoutes.js';
import callRoutes from './callRoutes.js';
import { runSeed } from '../controllers/seedController.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    uptime: process.uptime(),
    ts: Date.now(),
  });
});

router.post('/seed', runSeed);

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/categories', categoryRoutes);
router.use('/courses', courseRoutes);
router.use('/lessons', lessonRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/my', progressRoutes);
router.use('/uploads', uploadRoutes);
router.use('/reviews', reviewRoutes);
router.use('/sections', sectionRoutes);
router.use('/announcements', announcementRoutes);
router.use('/certificates', certificateRoutes);
router.use('/notes', noteRoutes);
router.use('/bookmarks', bookmarkRoutes);
router.use('/questions', questionRoutes);
router.use('/notifications', notificationRoutes);
router.use('/conversations', conversationRoutes);
router.use('/calls', callRoutes);

export default router;