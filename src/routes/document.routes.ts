/**
 * Document Routes
 * Handles document upload, analysis, and retrieval
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.middleware';
import {
  validateUpload,
  getUploadDir,
  cleanupFile
} from '../services/document-ingestion.service';
import { analyzeDocument } from '../services/scoring-engine.service';
import { DocumentAnalysis } from '../types';
import { sanitizeFilename } from '../utils';

// In-memory document storage (use database in production)
const documentStore = new Map<string, DocumentAnalysis>();
const dealDocuments = new Map<string, string[]>(); // dealId -> documentIds[]

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadDir());
  },
  filename: (req, file, cb) => {
    const uniqueName = `${randomUUID()}-${sanitizeFilename(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

const router = Router();

/**
 * POST /api/documents/upload
 * Upload and analyze a document
 */
router.post('/upload', requireAuth, upload.single('document'), async (req: Request, res: Response) => {
  const { dealId } = req.body;

  if (!dealId) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_DEAL_ID',
        message: 'Deal ID is required'
      }
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({
      success: false,
      error: {
        code: 'NO_FILE',
        message: 'No file uploaded'
      }
    });
    return;
  }

  const validation = validateUpload(
    req.file.originalname,
    req.file.mimetype,
    req.file.size
  );

  if (!validation.valid) {
    cleanupFile(req.file.path);
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE',
        message: validation.error
      }
    });
    return;
  }

  try {
    const documentId = randomUUID();
    const analysis = await analyzeDocument(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      documentId
    );

    // Store the analysis
    documentStore.set(documentId, analysis);

    // Associate with deal
    const existingDocs = dealDocuments.get(dealId) || [];
    existingDocs.push(documentId);
    dealDocuments.set(dealId, existingDocs);

    // Clean up uploaded file after analysis
    cleanupFile(req.file.path);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Document analysis failed:', error);
    if (req.file) {
      cleanupFile(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_FAILED',
        message: 'Failed to analyze document'
      }
    });
  }
});

/**
 * GET /api/documents/:documentId
 * Get a specific document analysis
 */
router.get('/:documentId', requireAuth, (req: Request, res: Response) => {
  const { documentId } = req.params;

  const analysis = documentStore.get(documentId);

  if (!analysis) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Document not found'
      }
    });
    return;
  }

  res.json({
    success: true,
    data: analysis
  });
});

/**
 * GET /api/documents/deal/:dealId
 * Get all documents for a deal
 */
router.get('/deal/:dealId', requireAuth, (req: Request, res: Response) => {
  const { dealId } = req.params;

  const documentIds = dealDocuments.get(dealId) || [];
  const documents = documentIds
    .map(id => documentStore.get(id))
    .filter((doc): doc is DocumentAnalysis => doc !== undefined);

  res.json({
    success: true,
    data: {
      dealId,
      documents,
      count: documents.length
    }
  });
});

/**
 * DELETE /api/documents/:documentId
 * Delete a document analysis
 */
router.delete('/:documentId', requireAuth, (req: Request, res: Response) => {
  const { documentId } = req.params;

  const existed = documentStore.delete(documentId);

  // Remove from deal associations
  for (const [dealId, docs] of dealDocuments.entries()) {
    const index = docs.indexOf(documentId);
    if (index !== -1) {
      docs.splice(index, 1);
      dealDocuments.set(dealId, docs);
    }
  }

  res.json({
    success: true,
    data: {
      deleted: existed
    }
  });
});

/**
 * POST /api/documents/:documentId/reanalyze
 * Re-analyze an existing document
 */
router.post('/:documentId/reanalyze', requireAuth, async (req: Request, res: Response) => {
  const { documentId } = req.params;

  const existingAnalysis = documentStore.get(documentId);

  if (!existingAnalysis) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Document not found'
      }
    });
    return;
  }

  // In a real implementation, you would re-process the stored document
  // For now, we just update the timestamp
  existingAnalysis.analyzedAt = new Date().toISOString();
  documentStore.set(documentId, existingAnalysis);

  res.json({
    success: true,
    data: existingAnalysis
  });
});

/**
 * GET /api/documents/:documentId/risks
 * Get risks for a specific document
 */
router.get('/:documentId/risks', requireAuth, (req: Request, res: Response) => {
  const { documentId } = req.params;

  const analysis = documentStore.get(documentId);

  if (!analysis) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Document not found'
      }
    });
    return;
  }

  res.json({
    success: true,
    data: {
      documentId,
      risks: analysis.risks,
      riskScore: analysis.riskScore
    }
  });
});

/**
 * GET /api/documents/:documentId/entities
 * Get extracted entities for a document
 */
router.get('/:documentId/entities', requireAuth, (req: Request, res: Response) => {
  const { documentId } = req.params;

  const analysis = documentStore.get(documentId);

  if (!analysis) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Document not found'
      }
    });
    return;
  }

  res.json({
    success: true,
    data: {
      documentId,
      entities: analysis.entities
    }
  });
});

/**
 * GET /api/documents/:documentId/blockers
 * Get blockers for a document
 */
router.get('/:documentId/blockers', requireAuth, (req: Request, res: Response) => {
  const { documentId } = req.params;

  const analysis = documentStore.get(documentId);

  if (!analysis) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Document not found'
      }
    });
    return;
  }

  res.json({
    success: true,
    data: {
      documentId,
      blockers: analysis.blockers,
      missingTerms: analysis.missingTerms
    }
  });
});

// Export for testing
export { documentStore, dealDocuments };
export default router;
