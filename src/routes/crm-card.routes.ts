/**
 * CRM Card Routes
 * Handles HubSpot CRM card data requests
 */

import { Router, Request, Response } from 'express';
import { validateHubSpotSignature } from '../middleware/auth.middleware';
import { generateCrmCardData } from '../services/crm-card.service';
import { DocumentAnalysis } from '../types';
import { documentStore, dealDocuments } from './document.routes';

const router = Router();

/**
 * GET /api/crm-card
 * Returns CRM card data for HubSpot
 * This endpoint is called by HubSpot when displaying the CRM card
 */
router.get('/', validateHubSpotSignature, (req: Request, res: Response) => {
  const { hs_object_id, portalId } = req.query;

  if (!hs_object_id) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_OBJECT_ID',
        message: 'HubSpot object ID is required'
      }
    });
    return;
  }

  const dealId = hs_object_id as string;
  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;

  // Get the most recent document analysis for the deal
  const documentIds = dealDocuments.get(dealId) || [];
  let latestAnalysis: DocumentAnalysis | null = null;

  if (documentIds.length > 0) {
    // Get the most recent analysis
    const analyses = documentIds
      .map(id => documentStore.get(id))
      .filter((doc): doc is DocumentAnalysis => doc !== undefined)
      .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());

    latestAnalysis = analyses[0] || null;
  }

  const cardData = generateCrmCardData(latestAnalysis, dealId, baseUrl);

  res.json(cardData);
});

/**
 * GET /api/crm-card/summary
 * Returns a summary for all documents associated with a deal
 */
router.get('/summary', validateHubSpotSignature, (req: Request, res: Response) => {
  const { hs_object_id } = req.query;

  if (!hs_object_id) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_OBJECT_ID',
        message: 'HubSpot object ID is required'
      }
    });
    return;
  }

  const dealId = hs_object_id as string;
  const documentIds = dealDocuments.get(dealId) || [];

  const analyses = documentIds
    .map(id => documentStore.get(id))
    .filter((doc): doc is DocumentAnalysis => doc !== undefined);

  if (analyses.length === 0) {
    res.json({
      success: true,
      data: {
        dealId,
        documentsCount: 0,
        overallRiskGrade: 'N/A',
        averageRiskScore: null,
        totalRisks: 0,
        totalBlockers: 0
      }
    });
    return;
  }

  // Calculate aggregate statistics
  const totalScore = analyses.reduce((sum, a) => sum + a.riskScore.overall, 0);
  const averageScore = Math.round(totalScore / analyses.length);
  const totalRisks = analyses.reduce((sum, a) => sum + a.risks.length, 0);
  const totalBlockers = analyses.reduce((sum, a) => sum + a.blockers.length, 0);

  // Determine overall grade based on average score
  let overallGrade: string;
  if (averageScore <= 20) overallGrade = 'A';
  else if (averageScore <= 40) overallGrade = 'B';
  else if (averageScore <= 60) overallGrade = 'C';
  else if (averageScore <= 80) overallGrade = 'D';
  else overallGrade = 'F';

  res.json({
    success: true,
    data: {
      dealId,
      documentsCount: analyses.length,
      overallRiskGrade: overallGrade,
      averageRiskScore: averageScore,
      totalRisks,
      totalBlockers,
      documents: analyses.map(a => ({
        documentId: a.documentId,
        filename: a.filename,
        documentType: a.documentType,
        riskGrade: a.riskScore.grade,
        risksCount: a.risks.length,
        blockersCount: a.blockers.length
      }))
    }
  });
});

export default router;
