/**
 * OAuth Routes
 * Handles HubSpot OAuth 2.0 authentication flow
 */

import { Router, Request, Response } from 'express';
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  removeTokens,
  isAuthenticated
} from '../services/oauth.service';

const router = Router();

/**
 * GET /oauth/authorize
 * Initiates the OAuth flow by redirecting to HubSpot
 */
router.get('/authorize', (req: Request, res: Response) => {
  const authUrl = getAuthorizationUrl();
  res.redirect(authUrl);
});

/**
 * GET /oauth/callback
 * Handles the OAuth callback from HubSpot
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code, error, error_description } = req.query;

  if (error) {
    res.status(400).json({
      success: false,
      error: {
        code: error as string,
        message: error_description as string || 'OAuth authorization failed'
      }
    });
    return;
  }

  if (!code || typeof code !== 'string') {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_CODE',
        message: 'Authorization code is required'
      }
    });
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // In production, redirect to success page or app
    res.json({
      success: true,
      data: {
        portalId: tokens.portalId,
        message: 'Successfully authenticated with HubSpot'
      }
    });
  } catch (err) {
    console.error('OAuth token exchange failed:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOKEN_EXCHANGE_FAILED',
        message: 'Failed to exchange authorization code for tokens'
      }
    });
  }
});

/**
 * GET /oauth/status
 * Check authentication status for a portal
 */
router.get('/status', (req: Request, res: Response) => {
  const portalId = req.query.portalId as string;

  if (!portalId) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PORTAL_ID',
        message: 'Portal ID is required'
      }
    });
    return;
  }

  const authenticated = isAuthenticated(portalId);

  res.json({
    success: true,
    data: {
      portalId,
      authenticated
    }
  });
});

/**
 * POST /oauth/logout
 * Remove tokens for a portal (logout)
 */
router.post('/logout', (req: Request, res: Response) => {
  const portalId = req.body.portalId as string;

  if (!portalId) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PORTAL_ID',
        message: 'Portal ID is required'
      }
    });
    return;
  }

  const removed = removeTokens(portalId);

  res.json({
    success: true,
    data: {
      portalId,
      loggedOut: removed
    }
  });
});

export default router;
