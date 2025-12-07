import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import * as dashboardService from '../services/dashboard.service';
import logger, { logService } from '../utils/logger';

interface RecentUpdatesQuery {
  page?: string;
  limit?: string;
}

export default async function dashboardRoutes(fastify: FastifyInstance) {
  // Add authentication to all routes in this plugin
  fastify.addHook('preHandler', authenticate);

  // GET /dashboard/stats
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    logService('DASHBOARD', 'Fetching dashboard stats');
    try {
      const stats = await dashboardService.getDashboardStats();
      logService('DASHBOARD', 'Dashboard stats fetched successfully', stats);
      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error fetching dashboard stats:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch dashboard stats',
      });
    }
  });

  // GET /dashboard/needs-acknowledgement
  fastify.get(
    '/needs-acknowledgement',
    async (request: FastifyRequest, reply: FastifyReply) => {
      logService('DASHBOARD', 'Fetching tickets needing acknowledgement');
      try {
        const tickets = await dashboardService.getNeedsAcknowledgement();
        logService('DASHBOARD', `Found ${tickets.length} tickets needing acknowledgement`);
        return reply.send({
          success: true,
          data: tickets,
        });
      } catch (error) {
        logger.error('Error fetching tickets needing acknowledgement:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch tickets',
        });
      }
    }
  );

  // GET /dashboard/recent-updates
  fastify.get(
    '/recent-updates',
    async (
      request: FastifyRequest<{ Querystring: RecentUpdatesQuery }>,
      reply: FastifyReply
    ) => {
      const page = parseInt(request.query.page || '1');
      const limit = parseInt(request.query.limit || '20');
      logService('DASHBOARD', `Fetching recent updates (page: ${page}, limit: ${limit})`);
      try {
        const result = await dashboardService.getRecentUpdates(page, limit);
        logService('DASHBOARD', `Found ${result.total} recent updates`);

        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
          },
        });
      } catch (error) {
        logger.error('Error fetching recent updates:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch recent updates',
        });
      }
    }
  );
}
