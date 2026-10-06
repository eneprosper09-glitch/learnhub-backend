import express from 'express';
import { body } from 'express-validator';
import * as c from '../controllers/livekitController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
router.use(protect);

router.post(
  '/direct/token',
  [body('userId').isMongoId().withMessage('Valid user id required')],
  validate,
  c.getDirectCallToken
);

router.post(
  '/group/token',
  [body('courseId').isMongoId().withMessage('Valid course id required')],
  validate,
  c.getGroupCallToken
);

router.post(
  '/group/end',
  [body('courseId').isMongoId().withMessage('Valid course id required')],
  validate,
  c.endGroupCall
);

router.get('/group/status/:courseId', c.getGroupCallStatus);

export default router;