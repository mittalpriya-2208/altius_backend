import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}] ${message}`;

  // Add stack trace for errors
  if (stack) {
    log += `\n${stack}`;
  }

  // Add metadata if present
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }

  return log;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
  ),
  transports: [
    // Console transport with colors
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        logFormat
      ),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat,
    }),
  ],
});

// Request logger helper
export const logRequest = (method: string, url: string, meta?: object) => {
  logger.info(`→ ${method} ${url}`, meta);
};

// Response logger helper
export const logResponse = (method: string, url: string, statusCode: number, duration: number) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  logger[level](`← ${method} ${url} ${statusCode} (${duration}ms)`);
};

// Auth logger helper
export const logAuth = (message: string, meta?: object) => {
  logger.debug(`[AUTH] ${message}`, meta);
};

// Service logger helper
export const logService = (service: string, message: string, meta?: object) => {
  logger.debug(`[${service.toUpperCase()}] ${message}`, meta);
};

export default logger;
