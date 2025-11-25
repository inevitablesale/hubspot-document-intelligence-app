/**
 * Authentication middleware
 * Validates HubSpot OAuth tokens and request signatures
 */

import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { getValidTokens, isAuthenticated } from '../services/oauth.service';
import { config } from '../config';

/**
 * Extend Express Request type with portal ID
 */
declare global {
  namespace Express {
    interface Request {
      portalId?: string;
    }
  }
}

/**
 * Rate limiter for API endpoints
 * Limits requests to prevent abuse
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Stricter rate limiter for sensitive operations like file uploads
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 uploads per hour
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many upload requests, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for OAuth endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per 15 minutes
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication requests, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Middleware to validate HubSpot authentication
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const portalId = req.headers['x-hubspot-portal-id'] as string ||
                   req.query.portalId as string ||
                   req.body?.portalId;

  if (!portalId) {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_PORTAL_ID',
        message: 'Portal ID is required'
      }
    });
    return;
  }

  if (!isAuthenticated(portalId)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Portal is not authenticated. Please complete OAuth flow.'
      }
    });
    return;
  }

  const tokens = await getValidTokens(portalId);
  if (!tokens) {
    res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication tokens have expired. Please re-authenticate.'
      }
    });
    return;
  }

  req.portalId = portalId;
  next();
}

/**
 * Middleware to validate HubSpot webhook signatures
 */
export function validateHubSpotSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const signature = req.headers['x-hubspot-signature'] as string;
  const signatureVersion = req.headers['x-hubspot-signature-version'] as string;

  if (!signature) {
    // Signature validation is optional in development
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_SIGNATURE',
        message: 'HubSpot signature is required'
      }
    });
    return;
  }

  const rawBody = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body);

  let isValid = false;

  if (signatureVersion === 'v2') {
    // v2: SHA-256 hash of client secret + HTTP method + URI + request body
    const sourceString = config.hubspot.clientSecret + req.method + req.originalUrl + rawBody;
    const expectedSignature = crypto
      .createHash('sha256')
      .update(sourceString)
      .digest('hex');
    isValid = expectedSignature === signature;
  } else {
    // v1: SHA-256 hash of client secret + request body
    const sourceString = config.hubspot.clientSecret + rawBody;
    const expectedSignature = crypto
      .createHash('sha256')
      .update(sourceString)
      .digest('hex');
    isValid = expectedSignature === signature;
  }

  if (!isValid) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_SIGNATURE',
        message: 'Invalid HubSpot signature'
      }
    });
    return;
  }

  next();
}

/**
 * Error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An internal error occurred'
        : err.message
    }
  });
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}
