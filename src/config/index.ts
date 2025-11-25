/**
 * Application configuration
 * Environment variables required for the HubSpot Document Intelligence App
 */

export interface AppConfig {
  port: number;
  hubspot: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
  };
  openai: {
    apiKey: string;
  };
  upload: {
    maxFileSize: number;
    allowedMimeTypes: string[];
  };
}

export function loadConfig(): AppConfig {
  const requiredEnvVars = [
    'HUBSPOT_CLIENT_ID',
    'HUBSPOT_CLIENT_SECRET',
    'HUBSPOT_REDIRECT_URI',
    'OPENAI_API_KEY'
  ];

  // Check for required environment variables in production
  if (process.env.NODE_ENV === 'production') {
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }
  }

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    hubspot: {
      clientId: process.env.HUBSPOT_CLIENT_ID || '',
      clientSecret: process.env.HUBSPOT_CLIENT_SECRET || '',
      redirectUri: process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
      scopes: [
        'crm.objects.deals.read',
        'crm.objects.deals.write',
        'files',
        'timeline',
        'oauth'
      ]
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || ''
    },
    upload: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/tiff',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    }
  };
}

export const config = loadConfig();
