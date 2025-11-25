/**
 * Health check and status routes
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * GET /health/ready
 * Readiness probe
 */
router.get('/ready', (req: Request, res: Response) => {
  // Check if all required services are ready
  const checks = {
    memory: process.memoryUsage().heapUsed < 500 * 1024 * 1024, // Less than 500MB
    uptime: process.uptime() > 0
  };

  const isReady = Object.values(checks).every(Boolean);

  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    checks,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/live
 * Liveness probe
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString()
  });
});

export default router;
