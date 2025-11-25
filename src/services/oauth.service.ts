/**
 * HubSpot OAuth Service
 * Handles OAuth 2.0 authentication flow with HubSpot
 */

import { Client } from '@hubspot/api-client';
import { config } from '../config';
import { OAuthTokens } from '../types';

// In-memory token storage (use Redis/DB in production)
const tokenStorage = new Map<string, OAuthTokens>();

/**
 * Generate the OAuth authorization URL
 */
export function getAuthorizationUrl(): string {
  const params = new URLSearchParams({
    client_id: config.hubspot.clientId,
    redirect_uri: config.hubspot.redirectUri,
    scope: config.hubspot.scopes.join(' ')
  });

  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const hubspotClient = new Client();

  const tokenResponse = await hubspotClient.oauth.tokensApi.create(
    'authorization_code',
    code,
    config.hubspot.redirectUri,
    config.hubspot.clientId,
    config.hubspot.clientSecret
  );

  const tokens: OAuthTokens = {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    expiresAt: Date.now() + tokenResponse.expiresIn * 1000
  };

  // Get portal ID from access token info
  const accessTokenInfo = await hubspotClient.oauth.accessTokensApi.get(tokens.accessToken);
  tokens.portalId = accessTokenInfo.hubId?.toString();

  if (tokens.portalId) {
    tokenStorage.set(tokens.portalId, tokens);
  }

  return tokens;
}

/**
 * Refresh expired tokens
 */
export async function refreshTokens(portalId: string): Promise<OAuthTokens | null> {
  const existingTokens = tokenStorage.get(portalId);
  if (!existingTokens) {
    return null;
  }

  const hubspotClient = new Client();

  const tokenResponse = await hubspotClient.oauth.tokensApi.create(
    'refresh_token',
    undefined,
    config.hubspot.redirectUri,
    config.hubspot.clientId,
    config.hubspot.clientSecret,
    existingTokens.refreshToken
  );

  const tokens: OAuthTokens = {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    expiresAt: Date.now() + tokenResponse.expiresIn * 1000,
    portalId
  };

  tokenStorage.set(portalId, tokens);
  return tokens;
}

/**
 * Get valid tokens for a portal, refreshing if needed
 */
export async function getValidTokens(portalId: string): Promise<OAuthTokens | null> {
  const tokens = tokenStorage.get(portalId);
  if (!tokens) {
    return null;
  }

  // Refresh if expiring within 5 minutes
  if (tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
    return refreshTokens(portalId);
  }

  return tokens;
}

/**
 * Get a HubSpot client with valid authentication
 */
export async function getHubSpotClient(portalId: string): Promise<Client | null> {
  const tokens = await getValidTokens(portalId);
  if (!tokens) {
    return null;
  }

  return new Client({ accessToken: tokens.accessToken });
}

/**
 * Store tokens (for testing or external storage integration)
 */
export function storeTokens(portalId: string, tokens: OAuthTokens): void {
  tokenStorage.set(portalId, tokens);
}

/**
 * Check if a portal is authenticated
 */
export function isAuthenticated(portalId: string): boolean {
  return tokenStorage.has(portalId);
}

/**
 * Remove tokens (logout)
 */
export function removeTokens(portalId: string): boolean {
  return tokenStorage.delete(portalId);
}
