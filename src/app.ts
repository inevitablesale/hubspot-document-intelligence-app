/**
 * HubSpot Document Intelligence App
 * Main application entry point
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { config } from './config';
import {
  oauthRoutes,
  documentRoutes,
  crmCardRoutes,
  webhookRoutes,
  healthRoutes
} from './routes';
import { errorHandler, requestLogger } from './middleware/auth.middleware';

/**
 * Create and configure the Express application
 */
export function createApp(): Express {
  const app = express();

  // Body parsers
  app.use(express.json({
    limit: '1mb',
    verify: (req: Request, res: Response, buf: Buffer) => {
      // Store raw body for signature verification
      (req as Request & { rawBody?: string }).rawBody = buf.toString();
    }
  }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Routes
  app.use('/oauth', oauthRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/crm-card', crmCardRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/health', healthRoutes);

  // Root endpoint
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'HubSpot Document Intelligence App',
      version: '1.0.0',
      description: 'AI-powered document analysis for HubSpot deals',
      endpoints: {
        oauth: '/oauth/authorize',
        documents: '/api/documents',
        crmCard: '/api/crm-card',
        webhooks: '/api/webhooks',
        health: '/health'
      }
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`
      }
    });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}

/**
 * Start the server
 */
export function startServer(): void {
  const app = createApp();
  const port = config.port;

  app.listen(port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     HubSpot Document Intelligence App                     ║
║     Running on port ${port}                                   ║
╚═══════════════════════════════════════════════════════════╝

Endpoints:
  - OAuth:      http://localhost:${port}/oauth/authorize
  - Documents:  http://localhost:${port}/api/documents
  - CRM Card:   http://localhost:${port}/api/crm-card
  - Health:     http://localhost:${port}/health
    `);
  });
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
