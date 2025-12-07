import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import * as ticketsService from '../services/tickets.service';
import logger, { logService } from '../utils/logger';

interface TicketParams {
  tt_number: string;
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export default async function attachmentsRoutes(fastify: FastifyInstance) {
  // Add authentication to all routes in this plugin
  fastify.addHook('preHandler', authenticate);

  // POST /tickets/:tt_number/attachments - Upload attachment
  fastify.post(
    '/:tt_number/attachments',
    async (
      request: FastifyRequest<{ Params: TicketParams }>,
      reply: FastifyReply
    ) => {
      const { tt_number } = request.params;
      const username = request.user?.['cognito:username'] || 'unknown';
      logService('ATTACHMENTS', `Uploading attachment for ticket: ${tt_number} by ${username}`);
      try {
        // Check if ticket exists
        const ticket = await ticketsService.getTicketByTTNumber(tt_number);
        if (!ticket) {
          logService('ATTACHMENTS', `Ticket not found: ${tt_number}`);
          return reply.status(404).send({
            success: false,
            error: 'Ticket not found',
          });
        }

        const data = await request.file();

        if (!data) {
          logService('ATTACHMENTS', 'No file uploaded');
          return reply.status(400).send({
            success: false,
            error: 'No file uploaded',
          });
        }

        logService('ATTACHMENTS', `File received: ${data.filename} (${data.mimetype})`);

        // Validate file type (only images allowed based on the UI)
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(data.mimetype)) {
          logService('ATTACHMENTS', `Invalid file type: ${data.mimetype}`);
          return reply.status(400).send({
            success: false,
            error: 'Invalid file type. Only images are allowed.',
          });
        }

        // Create ticket-specific directory
        const ticketDir = path.join(UPLOAD_DIR, tt_number);
        if (!fs.existsSync(ticketDir)) {
          fs.mkdirSync(ticketDir, { recursive: true });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const ext = path.extname(data.filename);
        const storedFilename = `${timestamp}${ext}`;
        const filepath = path.join(ticketDir, storedFilename);
        const filePath = `/uploads/${tt_number}/${storedFilename}`;

        // Save file to disk
        await pipeline(data.file, fs.createWriteStream(filepath));
        logService('ATTACHMENTS', `File saved to: ${filepath}`);

        // Save attachment to database and log activity
        const attachment = await ticketsService.addAttachment(
          tt_number,
          {
            originalFilename: data.filename,
            storedFilename,
            filePath,
            fileSize: data.file.bytesRead,
            mimeType: data.mimetype,
          },
          username
        );

        logService('ATTACHMENTS', `Attachment saved successfully: ${attachment.attachment_id}`);
        return reply.send({
          success: true,
          data: attachment,
          message: 'File uploaded successfully',
        });
      } catch (error) {
        logger.error(`Error uploading attachment for ticket ${tt_number}:`, error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to upload attachment',
        });
      }
    }
  );

  // GET /tickets/:tt_number/attachments - List attachments for a ticket
  fastify.get(
    '/:tt_number/attachments',
    async (
      request: FastifyRequest<{ Params: TicketParams }>,
      reply: FastifyReply
    ) => {
      const { tt_number } = request.params;
      logService('ATTACHMENTS', `Fetching attachments for ticket: ${tt_number}`);
      try {
        // Get attachments from database
        const attachments = await ticketsService.getTicketAttachments(tt_number);
        logService('ATTACHMENTS', `Found ${attachments.length} attachments for ticket: ${tt_number}`);

        return reply.send({
          success: true,
          data: attachments,
        });
      } catch (error) {
        logger.error(`Error listing attachments for ticket ${tt_number}:`, error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to list attachments',
        });
      }
    }
  );
}
