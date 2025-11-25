/**
 * Integration tests for API routes
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import { Express } from 'express';
import { storeTokens } from '../../src/services/oauth.service';

describe('API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
    // Set up test authentication
    storeTokens('test-portal', {
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      expiresAt: Date.now() + 3600000,
      portalId: 'test-portal'
    });
  });

  describe('GET /', () => {
    it('should return app info', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('HubSpot Document Intelligence App');
      expect(response.body.endpoints).toBeDefined();
    });
  });

  describe('Health Routes', () => {
    it('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    it('GET /health/ready should return readiness status', async () => {
      const response = await request(app).get('/health/ready');

      // Status can be 200 or 503 depending on timing
      expect([200, 503]).toContain(response.status);
      expect(response.body.ready).toBeDefined();
    });

    it('GET /health/live should return liveness status', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body.alive).toBe(true);
    });
  });

  describe('OAuth Routes', () => {
    it('GET /oauth/status should return auth status', async () => {
      const response = await request(app)
        .get('/oauth/status')
        .query({ portalId: 'test-portal' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.authenticated).toBe(true);
    });

    it('GET /oauth/status should require portalId', async () => {
      const response = await request(app).get('/oauth/status');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('POST /oauth/logout should log out portal', async () => {
      // Create a temporary portal to logout
      storeTokens('logout-test', {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: Date.now() + 3600000,
        portalId: 'logout-test'
      });

      const response = await request(app)
        .post('/oauth/logout')
        .send({ portalId: 'logout-test' });

      expect(response.status).toBe(200);
      expect(response.body.data.loggedOut).toBe(true);
    });
  });

  describe('Document Routes', () => {
    it('GET /api/documents/deal/:dealId should return documents for deal', async () => {
      const response = await request(app)
        .get('/api/documents/deal/123')
        .set('x-hubspot-portal-id', 'test-portal');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.documents).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/documents/deal/123');

      expect(response.status).toBe(401);
    });

    it('POST /api/documents/upload should require dealId', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('x-hubspot-portal-id', 'test-portal')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_DEAL_ID');
    });

    it('GET /api/documents/:id should return 404 for non-existent document', async () => {
      const response = await request(app)
        .get('/api/documents/non-existent-id')
        .set('x-hubspot-portal-id', 'test-portal');

      expect(response.status).toBe(404);
    });
  });

  describe('CRM Card Routes', () => {
    it('GET /api/crm-card should require object ID', async () => {
      const response = await request(app).get('/api/crm-card');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_OBJECT_ID');
    });

    it('GET /api/crm-card should return card data', async () => {
      const response = await request(app)
        .get('/api/crm-card')
        .query({ hs_object_id: '123' });

      expect(response.status).toBe(200);
      expect(response.body.results).toBeDefined();
    });

    it('GET /api/crm-card/summary should return summary data', async () => {
      const response = await request(app)
        .get('/api/crm-card/summary')
        .query({ hs_object_id: '123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
