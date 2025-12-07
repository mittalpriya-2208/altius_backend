import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import * as ticketsService from '../services/tickets.service';
import { TicketFilters, StatusUpdatePayload } from '../types';
import logger, { logService } from '../utils/logger';

interface TicketListQuery {
  status?: string;
  severity?: string;
  age?: string;
  search?: string;
  page?: string;
  limit?: string;
  sortBy?: 'newest' | 'oldest' | 'most_critical' | 'least_critical';
}

interface TicketParams {
  tt_number: string;
}

interface RemarksBody {
  remarks: string;
  attachment_id?: number;
}

export default async function ticketsRoutes(fastify: FastifyInstance) {
  // Add authentication to all routes in this plugin
  fastify.addHook('preHandler', authenticate);

  // GET /tickets - List tickets with filters
  fastify.get(
    '/',
    async (
      request: FastifyRequest<{ Querystring: TicketListQuery }>,
      reply: FastifyReply
    ) => {
      const { status, severity, age, search, page, limit, sortBy } = request.query;
      logService('TICKETS', 'Fetching tickets list', { status, severity, age, search, page, limit, sortBy });
      try {
        const filters: TicketFilters = {
          status: status ? status.split(',') : undefined,
          severity: severity ? severity.split(',') : undefined,
          age,
          search,
          page: page ? parseInt(page) : 1,
          limit: limit ? parseInt(limit) : 20,
          sortBy,
        };

        const result = await ticketsService.getTickets(filters);
        logService('TICKETS', `Fetched ${result.data.length} tickets`);

        return reply.send({
          success: true,
          ...result,
        });
      } catch (error) {
        logger.error('Error fetching tickets:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch tickets',
        });
      }
    }
  );

  // GET /tickets/:tt_number - Get single ticket details
  fastify.get(
    '/:tt_number',
    async (
      request: FastifyRequest<{ Params: TicketParams }>,
      reply: FastifyReply
    ) => {
      const { tt_number } = request.params;
      logService('TICKETS', `Fetching ticket details: ${tt_number}`);
      try {
        const ticket = await ticketsService.getTicketByTTNumber(tt_number);

        if (!ticket) {
          logService('TICKETS', `Ticket not found: ${tt_number}`);
          return reply.status(404).send({
            success: false,
            error: 'Ticket not found',
          });
        }

        logService('TICKETS', `Ticket found: ${tt_number}`);
        return reply.send({
          success: true,
          data: ticket,
        });
      } catch (error) {
        logger.error(`Error fetching ticket ${tt_number}:`, error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch ticket',
        });
      }
    }
  );

  // POST /tickets/:tt_number/acknowledge - Acknowledge a ticket
  fastify.post(
    '/:tt_number/acknowledge',
    async (
      request: FastifyRequest<{ Params: TicketParams }>,
      reply: FastifyReply
    ) => {
      const { tt_number } = request.params;
      const username = request.user?.['cognito:username'] || 'unknown';
      logService('TICKETS', `Acknowledging ticket: ${tt_number} by ${username}`);
      try {
        const ticket = await ticketsService.acknowledgeTicket(tt_number, username);

        if (!ticket) {
          logService('TICKETS', `Ticket not found for acknowledgement: ${tt_number}`);
          return reply.status(404).send({
            success: false,
            error: 'Ticket not found',
          });
        }

        logService('TICKETS', `Ticket acknowledged successfully: ${tt_number}`);
        return reply.send({
          success: true,
          data: ticket,
          message: 'Ticket acknowledged successfully',
        });
      } catch (error) {
        logger.error(`Error acknowledging ticket ${tt_number}:`, error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to acknowledge ticket',
        });
      }
    }
  );

  // PATCH /tickets/:tt_number/status - Update ticket status
  fastify.patch(
    '/:tt_number/status',
    async (
      request: FastifyRequest<{ Params: TicketParams; Body: StatusUpdatePayload }>,
      reply: FastifyReply
    ) => {
      const { tt_number } = request.params;
      const payload = request.body;
      const username = request.user?.['cognito:username'] || 'unknown';
      logService('TICKETS', `Updating ticket status: ${tt_number} to ${payload.status} by ${username}`);
      try {
        if (!payload.status) {
          logService('TICKETS', 'Status update failed: status is required');
          return reply.status(400).send({
            success: false,
            error: 'Status is required',
          });
        }

        const validStatuses = ['Assigned', 'In Progress', 'On Hold', 'Closed'];
        if (!validStatuses.includes(payload.status)) {
          logService('TICKETS', `Status update failed: invalid status ${payload.status}`);
          return reply.status(400).send({
            success: false,
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          });
        }

        const result = await ticketsService.updateTicketStatus(tt_number, payload, username);

        if (!result.ticket) {
          logService('TICKETS', `Ticket not found for status update: ${tt_number}`);
          return reply.status(404).send({
            success: false,
            error: 'Ticket not found',
          });
        }

        logService('TICKETS', `Ticket status updated successfully: ${tt_number} -> ${payload.status}`);
        return reply.send({
          success: true,
          data: {
            ticket: result.ticket,
            activity: result.activity,
          },
          message: 'Status updated successfully',
        });
      } catch (error) {
        logger.error(`Error updating ticket status ${tt_number}:`, error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to update ticket status',
        });
      }
    }
  );

  // POST /tickets/:tt_number/remarks - Add remarks to ticket (Add Remark action)
  fastify.post(
    '/:tt_number/remarks',
    async (
      request: FastifyRequest<{ Params: TicketParams; Body: RemarksBody }>,
      reply: FastifyReply
    ) => {
      const { tt_number } = request.params;
      const { remarks, attachment_id } = request.body;
      const username = request.user?.['cognito:username'] || 'unknown';
      logService('TICKETS', `Adding remarks to ticket: ${tt_number} by ${username}`);
      try {
        if (!remarks || remarks.trim() === '') {
          logService('TICKETS', 'Add remarks failed: remarks cannot be empty');
          return reply.status(400).send({
            success: false,
            error: 'Remarks cannot be empty',
          });
        }

        const result = await ticketsService.addRemarks(tt_number, remarks, username, attachment_id);

        if (!result.ticket) {
          logService('TICKETS', `Ticket not found for adding remarks: ${tt_number}`);
          return reply.status(404).send({
            success: false,
            error: 'Ticket not found',
          });
        }

        logService('TICKETS', `Remarks added successfully to ticket: ${tt_number}`);
        return reply.send({
          success: true,
          data: {
            ticket: result.ticket,
            activity: result.activity,
          },
          message: 'Remarks added successfully',
        });
      } catch (error) {
        logger.error(`Error adding remarks to ticket ${tt_number}:`, error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to add remarks',
        });
      }
    }
  );

  // GET /tickets/:tt_number/timeline - Get ticket activity timeline
  fastify.get(
    '/:tt_number/timeline',
    async (
      request: FastifyRequest<{ Params: TicketParams }>,
      reply: FastifyReply
    ) => {
      const { tt_number } = request.params;
      logService('TICKETS', `Fetching timeline for ticket: ${tt_number}`);
      try {
        // First check if ticket exists
        const ticket = await ticketsService.getTicketByTTNumber(tt_number);
        if (!ticket) {
          logService('TICKETS', `Ticket not found for timeline: ${tt_number}`);
          return reply.status(404).send({
            success: false,
            error: 'Ticket not found',
          });
        }

        const timeline = await ticketsService.getTicketTimeline(tt_number);
        logService('TICKETS', `Fetched ${timeline.length} timeline entries for ticket: ${tt_number}`);

        return reply.send({
          success: true,
          data: timeline,
        });
      } catch (error) {
        logger.error(`Error fetching ticket timeline ${tt_number}:`, error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch ticket timeline',
        });
      }
    }
  );
}
