/**
 * Document Ingestion Service
 * Handles PDF parsing and OCR for document text extraction
 */

import * as fs from 'fs';
import * as path from 'path';
import { PDFParse } from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { ParsedDocument, DocumentType } from '../types';
import { config } from '../config';

/**
 * Parse a PDF document and extract text
 */
export async function parsePdf(filePath: string): Promise<ParsedDocument> {
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const textResult = await parser.getText();
  const infoResult = await parser.getInfo();

  await parser.destroy();

  return {
    text: textResult.text,
    pages: textResult.pages?.length || 1,
    metadata: {
      title: infoResult.info?.title || '',
      author: infoResult.info?.author || '',
      creator: infoResult.info?.creator || '',
      producer: infoResult.info?.producer || ''
    },
    confidence: 1.0 // PDFs have high confidence
  };
}

/**
 * Perform OCR on an image file
 */
export async function performOcr(filePath: string): Promise<ParsedDocument> {
  const result = await Tesseract.recognize(filePath, 'eng', {
    logger: () => {} // Silent logging
  });

  return {
    text: result.data.text,
    pages: 1,
    metadata: {},
    confidence: result.data.confidence / 100
  };
}

/**
 * Ingest a document (auto-detect type and extract text)
 */
export async function ingestDocument(
  filePath: string,
  mimeType: string
): Promise<ParsedDocument> {
  const isPdf = mimeType === 'application/pdf';
  const isImage = mimeType.startsWith('image/');

  if (isPdf) {
    const parsedPdf = await parsePdf(filePath);
    
    // If PDF text extraction is poor, try OCR
    if (parsedPdf.text.trim().length < 100) {
      try {
        const ocrResult = await performOcr(filePath);
        if (ocrResult.text.length > parsedPdf.text.length) {
          return ocrResult;
        }
      } catch {
        // Fall back to PDF text if OCR fails
      }
    }
    
    return parsedPdf;
  }

  if (isImage) {
    return performOcr(filePath);
  }

  // For other document types, attempt basic text extraction
  const content = fs.readFileSync(filePath, 'utf-8');
  return {
    text: content,
    pages: 1,
    metadata: {},
    confidence: 0.8
  };
}

/**
 * Detect document type from content
 */
export function detectDocumentType(text: string, filename: string): DocumentType {
  const lowerText = text.toLowerCase();
  const lowerFilename = filename.toLowerCase();

  // Check filename first
  if (lowerFilename.includes('nda') || lowerFilename.includes('non-disclosure')) {
    return 'nda';
  }
  if (lowerFilename.includes('proposal')) {
    return 'proposal';
  }
  if (lowerFilename.includes('contract')) {
    return 'contract';
  }
  if (lowerFilename.includes('agreement')) {
    return 'agreement';
  }
  if (lowerFilename.includes('invoice')) {
    return 'invoice';
  }
  if (lowerFilename.includes('sow') || lowerFilename.includes('statement of work')) {
    return 'sow';
  }
  if (lowerFilename.includes('msa') || lowerFilename.includes('master service')) {
    return 'msa';
  }

  // Check content patterns
  const patterns: Array<{ type: DocumentType; keywords: string[] }> = [
    { type: 'nda', keywords: ['non-disclosure', 'confidential information', 'proprietary'] },
    { type: 'proposal', keywords: ['proposal', 'proposed solution', 'pricing', 'quote'] },
    { type: 'contract', keywords: ['agreement', 'terms and conditions', 'hereby agree'] },
    { type: 'invoice', keywords: ['invoice', 'bill to', 'payment due', 'amount due'] },
    { type: 'sow', keywords: ['statement of work', 'deliverables', 'scope of work'] },
    { type: 'msa', keywords: ['master service agreement', 'master agreement'] }
  ];

  for (const pattern of patterns) {
    const matchCount = pattern.keywords.filter(kw => lowerText.includes(kw)).length;
    if (matchCount >= 2) {
      return pattern.type;
    }
  }

  return 'unknown';
}

/**
 * Validate file upload
 */
export function validateUpload(
  filename: string,
  mimeType: string,
  size: number
): { valid: boolean; error?: string } {
  if (size > config.upload.maxFileSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed (${config.upload.maxFileSize / 1024 / 1024}MB)`
    };
  }

  if (!config.upload.allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `File type not allowed. Supported types: ${config.upload.allowedMimeTypes.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Get the upload directory path
 */
export function getUploadDir(): string {
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
}

/**
 * Clean up temporary files
 */
export function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}
