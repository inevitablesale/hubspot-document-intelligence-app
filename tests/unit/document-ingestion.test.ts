/**
 * Unit tests for the document ingestion service
 */

import {
  detectDocumentType,
  validateUpload
} from '../../src/services/document-ingestion.service';

// Mock config
jest.mock('../../src/config', () => ({
  config: {
    upload: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'application/pdf',
        'image/png',
        'image/jpeg'
      ]
    }
  }
}));

describe('Document Ingestion Service', () => {
  describe('detectDocumentType', () => {
    it('should detect NDA from filename', () => {
      const type = detectDocumentType('', 'NDA-Company-2024.pdf');
      expect(type).toBe('nda');
    });

    it('should detect NDA from filename (non-disclosure)', () => {
      const type = detectDocumentType('', 'non-disclosure-agreement.pdf');
      expect(type).toBe('nda');
    });

    it('should detect proposal from filename', () => {
      const type = detectDocumentType('', 'proposal-q4-2024.pdf');
      expect(type).toBe('proposal');
    });

    it('should detect contract from filename', () => {
      const type = detectDocumentType('', 'service-contract.pdf');
      expect(type).toBe('contract');
    });

    it('should detect agreement from filename', () => {
      const type = detectDocumentType('', 'licensing-agreement.pdf');
      expect(type).toBe('agreement');
    });

    it('should detect invoice from filename', () => {
      const type = detectDocumentType('', 'invoice-12345.pdf');
      expect(type).toBe('invoice');
    });

    it('should detect SOW from filename', () => {
      const type = detectDocumentType('', 'sow-project-alpha.pdf');
      expect(type).toBe('sow');
    });

    it('should detect MSA from filename', () => {
      const type = detectDocumentType('', 'msa-enterprise.pdf');
      expect(type).toBe('msa');
    });

    it('should detect NDA from content', () => {
      const text = 'This Non-Disclosure Agreement contains confidential information that is proprietary.';
      const type = detectDocumentType(text, 'document.pdf');
      expect(type).toBe('nda');
    });

    it('should detect proposal from content', () => {
      const text = 'This proposal outlines the proposed solution including pricing and quote details.';
      const type = detectDocumentType(text, 'document.pdf');
      expect(type).toBe('proposal');
    });

    it('should detect contract from content', () => {
      const text = 'This agreement contains terms and conditions. The parties hereby agree to the following.';
      const type = detectDocumentType(text, 'document.pdf');
      expect(type).toBe('contract');
    });

    it('should detect invoice from content', () => {
      const text = 'Invoice #12345. Bill to: Customer Inc. Payment due: Net 30. Amount due: $5000';
      const type = detectDocumentType(text, 'document.pdf');
      expect(type).toBe('invoice');
    });

    it('should detect SOW from content', () => {
      const text = 'This Statement of Work outlines the deliverables and scope of work for the project.';
      const type = detectDocumentType(text, 'document.pdf');
      expect(type).toBe('sow');
    });

    it('should return unknown for unrecognized documents', () => {
      const text = 'Some random text that does not match any pattern.';
      const type = detectDocumentType(text, 'random-file.pdf');
      expect(type).toBe('unknown');
    });
  });

  describe('validateUpload', () => {
    it('should accept valid PDF file', () => {
      const result = validateUpload('document.pdf', 'application/pdf', 1024 * 1024);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid PNG file', () => {
      const result = validateUpload('image.png', 'image/png', 500 * 1024);
      expect(result.valid).toBe(true);
    });

    it('should accept valid JPEG file', () => {
      const result = validateUpload('image.jpg', 'image/jpeg', 500 * 1024);
      expect(result.valid).toBe(true);
    });

    it('should reject file exceeding size limit', () => {
      const result = validateUpload('large.pdf', 'application/pdf', 20 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('size');
    });

    it('should reject unsupported file type', () => {
      const result = validateUpload('script.exe', 'application/x-executable', 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('type');
    });

    it('should reject unsupported mime type', () => {
      const result = validateUpload('data.json', 'application/json', 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('type');
    });
  });
});
