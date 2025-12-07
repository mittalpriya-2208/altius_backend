import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import * as userService from '../services/user.service';
import logger, { logService } from '../utils/logger';

export default async function userRoutes(fastify: FastifyInstance) {
  // Add authentication to all routes in this plugin
  fastify.addHook('preHandler', authenticate);

  // GET /users/me - Get current user profile
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    logService('USER', 'Fetching current user profile');
    try {
      if (!request.user) {
        logService('USER', 'User not authenticated');
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated',
        });
      }

      const profile = userService.getUserProfile(request.user);
      logService('USER', `Profile fetched for user: ${profile.username}`);

      return reply.send({
        success: true,
        data: profile,
      });
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user profile',
      });
    }
  });
}
