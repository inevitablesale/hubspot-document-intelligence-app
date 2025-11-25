# HubSpot Document Intelligence App

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An installable HubSpot App that analyzes uploaded documents—contracts, proposals, NDAs, PDFs—and extracts key terms, risks, blockers, and insights using AI. Generates a Document Risk Score, highlights missing requirements, and surfaces findings directly on deal records.

## Features

- **Document Ingestion**: Upload and process PDFs, images, and other document formats
- **AI-Powered Analysis**: Extract entities, identify risks, and detect missing terms using OpenAI
- **OCR Support**: Process scanned documents with Tesseract.js
- **Document Risk Score**: Calculate and display risk grades (A-F) with detailed breakdowns
- **CRM Card Integration**: Display document insights directly on HubSpot deal records
- **Timeline Events**: Create audit trail of document analysis events
- **OAuth Authentication**: Secure HubSpot OAuth 2.0 integration
- **REST API**: Full API for document operations

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HubSpot CRM                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Deal Card  │  │  Timeline   │  │  Webhooks   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│               Document Intelligence API                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  OAuth    │  Documents  │  CRM Cards  │  Webhooks    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Document Ingestion  │  AI Parsing  │  Scoring Engine│   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ PDF Parse│    │ Tesseract│    │  OpenAI  │
    └──────────┘    └──────────┘    └──────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- HubSpot Developer Account
- OpenAI API Key (optional, for AI features)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/inevitablesale/hubspot-document-intelligence-app.git
cd hubspot-document-intelligence-app
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Build the project:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `APP_BASE_URL` | Base URL for the app | No |
| `HUBSPOT_CLIENT_ID` | HubSpot OAuth client ID | Yes |
| `HUBSPOT_CLIENT_SECRET` | HubSpot OAuth client secret | Yes |
| `HUBSPOT_REDIRECT_URI` | OAuth callback URL | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI features | No |

### HubSpot App Setup

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Create a new app
3. Configure OAuth with the following scopes:
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `files`
   - `timeline`
   - `oauth`
4. Set the redirect URI to your app's callback URL
5. Copy the Client ID and Client Secret to your `.env` file

### CRM Card Configuration

Add a CRM card to your HubSpot app with the following settings:

- **Card Title**: Document Intelligence
- **Fetch URL**: `{YOUR_APP_URL}/api/crm-card`
- **Object Types**: Deals
- **Card Location**: Sidebar

## API Reference

### Authentication

#### Initiate OAuth Flow
```
GET /oauth/authorize
```
Redirects to HubSpot OAuth consent screen.

#### OAuth Callback
```
GET /oauth/callback?code={authorization_code}
```
Exchanges authorization code for tokens.

#### Check Auth Status
```
GET /oauth/status?portalId={portal_id}
```
Returns authentication status for a portal.

### Documents

#### Upload Document
```
POST /api/documents/upload
Content-Type: multipart/form-data

Headers:
  x-hubspot-portal-id: {portal_id}

Body:
  document: (file)
  dealId: {deal_id}
```

#### Get Document Analysis
```
GET /api/documents/{documentId}
Headers:
  x-hubspot-portal-id: {portal_id}
```

#### Get Documents for Deal
```
GET /api/documents/deal/{dealId}
Headers:
  x-hubspot-portal-id: {portal_id}
```

#### Get Document Risks
```
GET /api/documents/{documentId}/risks
Headers:
  x-hubspot-portal-id: {portal_id}
```

#### Get Document Entities
```
GET /api/documents/{documentId}/entities
Headers:
  x-hubspot-portal-id: {portal_id}
```

### CRM Card

#### Get Card Data
```
GET /api/crm-card?hs_object_id={deal_id}
```
Returns CRM card data for HubSpot.

#### Get Deal Summary
```
GET /api/crm-card/summary?hs_object_id={deal_id}
```
Returns aggregated document analysis for a deal.

### Health

```
GET /health        # Health check
GET /health/ready  # Readiness probe
GET /health/live   # Liveness probe
```

## Document Risk Score

The app calculates a Document Risk Score (0-100) based on:

| Category | Weight | Description |
|----------|--------|-------------|
| Missing Clauses | 15 | Standard clauses not found |
| Unfavorable Terms | 20 | Terms that may be disadvantageous |
| Compliance Issues | 25 | Potential regulatory concerns |
| Liability Exposure | 30 | Liability-related risks |
| Termination Risk | 15 | Unfavorable termination terms |
| Payment Risk | 20 | Payment-related concerns |
| Legal Ambiguity | 10 | Unclear or vague language |

### Risk Grades

| Grade | Score Range | Description |
|-------|-------------|-------------|
| A | 0-20 | Low Risk |
| B | 21-40 | Moderate Risk |
| C | 41-60 | Medium Risk |
| D | 61-80 | High Risk |
| F | 81-100 | Critical Risk |

## Supported Document Types

- **Contracts** - Service agreements, licensing agreements
- **NDAs** - Non-disclosure agreements
- **Proposals** - Sales proposals, quotes
- **SOWs** - Statements of work
- **MSAs** - Master service agreements
- **Invoices** - Billing documents
- **General** - Other document types

## Development

### Project Structure

```
├── src/
│   ├── config/          # Configuration management
│   ├── middleware/      # Express middleware
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic
│   │   ├── oauth.service.ts           # HubSpot OAuth
│   │   ├── document-ingestion.service.ts  # PDF/OCR processing
│   │   ├── ai-parsing.service.ts      # AI entity extraction
│   │   ├── scoring-engine.service.ts  # Risk scoring
│   │   └── crm-card.service.ts        # CRM card generation
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   ├── app.ts           # Express app
│   └── index.ts         # Entry point
├── tests/
│   ├── unit/            # Unit tests
│   └── integration/     # API tests
├── uploads/             # Temporary file storage
└── dist/                # Compiled output
```

### Scripts

```bash
npm run build      # Compile TypeScript
npm run start      # Start production server
npm run dev        # Build and run
npm run test       # Run tests with coverage
npm run test:watch # Run tests in watch mode
npm run lint       # Type check
npm run clean      # Remove build artifacts
```

### Running Tests

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run specific test file
npm test -- tests/unit/scoring-engine.test.ts
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/

EXPOSE 3000
CMD ["node", "dist/app.js"]
```

### Environment Setup

1. Set all required environment variables
2. Ensure HubSpot OAuth redirect URI matches your deployment URL
3. Configure CRM card fetch URL in HubSpot app settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- [HubSpot Developer Documentation](https://developers.hubspot.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [GitHub Issues](https://github.com/inevitablesale/hubspot-document-intelligence-app/issues)
