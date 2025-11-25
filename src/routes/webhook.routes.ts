/**
 * Webhook Routes
 * Handles HubSpot webhooks and events
 */

import { Router, Request, Response } from 'express';
import { validateHubSpotSignature } from '../middleware/auth.middleware';
import { createTimelineEvent } from '../services/crm-card.service';
import { documentStore } from './document.routes';

const router = Router();

/**
 * POST /api/webhooks/deal-update
 * Handle deal update webhooks from HubSpot
 */
router.post('/deal-update', validateHubSpotSignature, async (req: Request, res: Response) => {
  const events = req.body;

  if (!Array.isArray(events)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'Expected array of events'
      }
    });
    return;
  }

  try {
    for (const event of events) {
      const { objectId, propertyName, propertyValue, portalId } = event;

      // Handle deal stage changes
      if (propertyName === 'dealstage') {
        console.log(`Deal ${objectId} stage changed to ${propertyValue}`);

        // You could trigger re-analysis or notifications here
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: 'Failed to process webhook'
      }
    });
  }
});

/**
 * POST /api/webhooks/file-upload
 * Handle file upload webhooks from HubSpot
 */
router.post('/file-upload', validateHubSpotSignature, async (req: Request, res: Response) => {
  const { objectId, fileId, filename, portalId } = req.body;

  try {
    console.log(`File ${filename} uploaded for deal ${objectId}`);

    // In a real implementation, you would:
    // 1. Download the file from HubSpot
    // 2. Process and analyze it
    // 3. Create a timeline event

    res.json({
      success: true,
      data: {
        message: 'File upload webhook received',
        fileId,
        objectId
      }
    });
  } catch (error) {
    console.error('File upload webhook error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: 'Failed to process file upload webhook'
      }
    });
  }
});

/**
 * POST /api/webhooks/action
 * Handle action hook callbacks from CRM cards
 */
router.post('/action', validateHubSpotSignature, async (req: Request, res: Response) => {
  const { action, objectId, documentId, portalId } = req.body;

  try {
    switch (action) {
      case 'reanalyze':
        const analysis = documentStore.get(documentId);
        if (analysis) {
          analysis.analyzedAt = new Date().toISOString();
          documentStore.set(documentId, analysis);
        }
        break;

      case 'dismiss_risk':
        // Handle risk dismissal
        break;

      case 'mark_resolved':
        // Handle blocker resolution
        break;

      default:
        console.log(`Unknown action: ${action}`);
    }

    res.json({
      success: true,
      data: {
        action,
        processed: true
      }
    });
  } catch (error) {
    console.error('Action webhook error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ACTION_FAILED',
        message: 'Failed to process action'
      }
    });
  }
});

export default router;
