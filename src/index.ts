import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import dotenv from 'dotenv';
import { registerRoutes } from './routes';
import logger, { logRequest, logResponse } from './utils/logger';

// Load environment variables
dotenv.config();

logger.info('Starting server...');
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`SKIP_AUTH: ${process.env.SKIP_AUTH}`);

const fastify = Fastify({
  logger: false, // Disable default Pino logger, using Winston instead
});

// Register plugins
fastify.register(cors, {
  origin: true, // Allow all origins in development
  credentials: true,
});

fastify.register(multipart, {
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
});

// Global request/response logging hook
fastify.addHook('onRequest', async (request) => {
  const startTime = Date.now();
  request.startTime = startTime;
  logRequest(request.method, request.url, { ip: request.ip });
});

fastify.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - (request.startTime || Date.now());
  logResponse(request.method, request.url, reply.statusCode, duration);
});

// Health check endpoint (no auth required)
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register all routes
registerRoutes(fastify);

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    logger.info(`Server running at http://${host}:${port}`);
    logger.info('Ready to accept connections');
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
