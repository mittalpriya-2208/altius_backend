import { FastifyInstance } from 'fastify';
import dashboardRoutes from './dashboard.routes';
import ticketsRoutes from './tickets.routes';
import attachmentsRoutes from './attachments.routes';
import notificationsRoutes from './notifications.routes';
import userRoutes from './user.routes';

export async function registerRoutes(fastify: FastifyInstance) {
  // Dashboard routes
  fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });

  // Tickets routes
  fastify.register(ticketsRoutes, { prefix: '/api/tickets' });

  // Attachments routes (under tickets)
  fastify.register(attachmentsRoutes, { prefix: '/api/tickets' });

  // Notifications routes
  fastify.register(notificationsRoutes, { prefix: '/api/notifications' });

  // User routes
  fastify.register(userRoutes, { prefix: '/api/users' });
}
