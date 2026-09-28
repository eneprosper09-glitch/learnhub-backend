import express from 'express';
import * as c from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { inviteRules, roleChangeRules } from '../validators/admin.validator.js';

const router = express.Router();
router.use(protect);

router.post('/invite', authorize('admin'), inviteRules, validate, c.inviteAdmin);
router.post('/invite/accept', c.acceptAdminInvitation);

router.get('/users', authorize('admin'), c.getUsers);
router.put('/users/:id/role', authorize('admin'), roleChangeRules, validate, c.changeUserRole);
router.put('/users/:id/deactivate', authorize('admin'), c.toggleUserActive);
router.put('/users/:id/approve-instructor', authorize('admin'), c.approveInstructor);

export default router;