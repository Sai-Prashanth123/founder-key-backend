import { Router } from 'express';
import usersController from './users.controller';
import { authenticate } from '@middlewares/authenticate';
import { validate } from '@middlewares/validate';
import { uploadSingle } from '@middlewares/upload';
import { updateProfileSchema, searchUsersSchema } from './users.validation';

const router = Router();

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get my profile
 */
router.get('/me', authenticate, usersController.getMyProfile.bind(usersController));

/**
 * @openapi
 * /users/me:
 *   put:
 *     tags: [Users]
 *     summary: Update my profile
 */
router.put(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  usersController.updateProfile.bind(usersController)
);

/**
 * @openapi
 * /users/me/avatar:
 *   put:
 *     tags: [Users]
 *     summary: Upload/update avatar
 */
router.put(
  '/me/avatar',
  authenticate,
  uploadSingle('avatar'),
  usersController.updateAvatar.bind(usersController)
);

/**
 * @openapi
 * /users/me/avatar:
 *   delete:
 *     tags: [Users]
 *     summary: Delete avatar
 */
router.delete('/me/avatar', authenticate, usersController.deleteAvatar.bind(usersController));

/**
 * @openapi
 * /users/search:
 *   get:
 *     tags: [Users]
 *     summary: Search users
 */
router.get(
  '/search',
  authenticate,
  validate(searchUsersSchema, 'query'),
  usersController.searchUsers.bind(usersController)
);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID
 */
router.get('/:id', authenticate, usersController.getUserById.bind(usersController));

/**
 * @openapi
 * /users/{id}/stats:
 *   get:
 *     tags: [Users]
 *     summary: Get user stats
 */
router.get('/:id/stats', authenticate, usersController.getUserStats.bind(usersController));

export default router;
