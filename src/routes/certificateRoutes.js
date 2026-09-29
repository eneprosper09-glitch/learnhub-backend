import express from 'express';
import * as c from '../controllers/certificateController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/verify/:certificateId', c.verifyCertificate);
router.get('/course/:courseId', protect, c.getCertificateForCourse);
router.get('/me', protect, c.getMyCertificates);

export default router;