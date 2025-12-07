import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import * as notificationsService from '../services/notifications.service';
import logger, { logService } from '../utils/logger';

export default async function notificationsRoutes(fastify: FastifyInstance) {
  // Add authentication to all routes in this plugin
  fastify.addHook('preHandler', authenticate);

  // GET /notifications/pending-actions
  fastify.get(
    '/pending-actions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const username = request.user?.['cognito:username'] || 'unknown';
      logService('NOTIFICATIONS', `Fetching pending actions for user: ${username}`);
      try {
        const pendingActions = await notificationsService.getPendingActions(username);
        logService('NOTIFICATIONS', `Found ${pendingActions.length} pending actions for user: ${username}`);

        return reply.send({
          success: true,
          data: pendingActions,
          count: pendingActions.length,
        });
      } catch (error) {
        logger.error('Error fetching pending actions:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch pending actions',
        });
      }
    }
  );

  // GET /notifications/count
  fastify.get(
    '/count',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const username = request.user?.['cognito:username'] || 'unknown';
      logService('NOTIFICATIONS', `Fetching notification count for user: ${username}`);
      try {
        const count = await notificationsService.getNotificationCount(username);
        logService('NOTIFICATIONS', `Notification count for ${username}: ${count}`);

        return reply.send({
          success: true,
          count,
        });
      } catch (error) {
        logger.error('Error fetching notification count:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch notification count',
        });
      }
    }
  );

  // POST /notifications/mark-read
  fastify.post(
    '/mark-read',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const username = request.user?.['cognito:username'] || 'unknown';
      logService('NOTIFICATIONS', `Marking notifications as read for user: ${username}`);
      try {
        // In a real app, you'd track read status in a separate table
        // For now, we just return success
        logService('NOTIFICATIONS', `All notifications marked as read for user: ${username}`);
        return reply.send({
          success: true,
          message: 'All notifications marked as read',
        });
      } catch (error) {
        logger.error('Error marking notifications as read:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to mark notifications as read',
        });
      }
    }
  );
}
