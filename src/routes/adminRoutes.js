import express from 'express';
import multer from 'multer';
import * as c from '../controllers/adminController.js';
import * as importer from '../controllers/adminImportController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { inviteRules, roleChangeRules } from '../validators/admin.validator.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(protect);

router.post('/invite', authorize('admin'), inviteRules, validate, c.inviteAdmin);
router.post('/invite/accept', c.acceptAdminInvitation);

router.get('/users', authorize('admin'), c.getUsers);
router.put(
  '/users/:id/role',
  authorize('admin'),
  roleChangeRules,
  validate,
  c.changeUserRole
);
router.put('/users/:id/deactivate', authorize('admin'), c.toggleUserActive);
router.put('/users/:id/approve-instructor', authorize('admin'), c.approveInstructor);

// Bulk import
router.post(
  '/import/users',
  authorize('admin'),
  upload.single('file'),
  importer.importUsers
);

// CSV exports
router.get('/export/users', authorize('admin'), importer.exportUsersCSV);
router.get('/export/enrollments', authorize('admin'), importer.exportEnrollmentsCSV);

export default router;