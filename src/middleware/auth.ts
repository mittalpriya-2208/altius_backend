import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { CognitoUser } from '../types';
import logger, { logAuth } from '../utils/logger';

const region = process.env.COGNITO_REGION || 'ap-south-1';
const userPoolId = process.env.COGNITO_USER_POOL_ID;

// Mock user for testing when auth is skipped
const MOCK_USER: CognitoUser = {
  sub: 'mock-user-id-12345',
  email: 'prem.kumar@engineer.com',
  username: 'prem.kumar',
  'cognito:username': 'prem.kumar',
  'custom:role': 'Field Engineer',
};

const client = jwksClient({
  jwksUri: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
});

const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
};

export const verifyToken = (token: string): Promise<CognitoUser> => {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
      },
      (err, decoded) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(decoded as CognitoUser);
      }
    );
  });
};

export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const { method, url } = request;
  const skipAuth = process.env.SKIP_AUTH === 'true';
  logAuth(`Incoming request: ${method} ${url} (SKIP_AUTH=${skipAuth})`);

  // Skip auth in development/testing mode
  if (skipAuth) {
    logAuth(`Skipping authentication (SKIP_AUTH=true) for ${method} ${url}`);
    request.user = MOCK_USER;
    return;
  }

  try {
    const authHeader = request.headers.authorization;
    logAuth(`Auth header present: ${!!authHeader}`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logAuth(`Missing or invalid auth header for ${method} ${url}`);
      return reply.status(401).send({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7);
    logAuth(`Verifying token for ${method} ${url}`);
    const user = await verifyToken(token);
    logAuth(`Token verified successfully for user: ${user.email || user.sub}`);
    request.user = user;
  } catch (error) {
    logger.error(`Authentication error for ${method} ${url}:`, error);
    return reply.status(401).send({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};
