/**
 * Unit tests for CRM card service
 */

import { generateCrmCardData } from '../../src/services/crm-card.service';
import { DocumentAnalysis } from '../../src/types';

describe('CRM Card Service', () => {
  describe('generateCrmCardData', () => {
    it('should return empty state when no analysis exists', () => {
      const cardData = generateCrmCardData(null, '123', 'http://localhost:3000');

      expect(cardData.results).toHaveLength(1);
      expect(cardData.results[0].properties[0].value).toContain('No documents');
    });

    it('should include upload action when no analysis exists', () => {
      const cardData = generateCrmCardData(null, '123', 'http://localhost:3000');

      expect(cardData.results[0].actions).toBeDefined();
      expect(cardData.results[0].actions![0].label).toBe('Upload Document');
    });

    it('should generate card data from analysis', () => {
      const analysis: DocumentAnalysis = {
        documentId: 'doc-123',
        filename: 'contract.pdf',
        documentType: 'contract',
        uploadedAt: '2024-01-15T10:00:00Z',
        analyzedAt: '2024-01-15T10:01:00Z',
        entities: [],
        risks: [
          {
            id: '1',
            category: 'missing_clause',
            severity: 'medium',
            title: 'Missing Termination',
            description: 'No termination clause found',
            recommendation: 'Add termination clause'
          }
        ],
        missingTerms: [],
        blockers: [],
        riskScore: {
          overall: 25,
          grade: 'B',
          breakdown: {
            missingClauses: 10,
            unfavorableTerms: 5,
            complianceIssues: 5,
            liabilityExposure: 5
          }
        },
        summary: 'This is a test contract.'
      };

      const cardData = generateCrmCardData(analysis, '123', 'http://localhost:3000');

      // Should have multiple sections
      expect(cardData.results.length).toBeGreaterThan(1);

      // First section should be risk score
      expect(cardData.results[0].title).toBe('Document Risk Score');

      // Should have primary action
      expect(cardData.primaryAction).toBeDefined();
      expect(cardData.primaryAction!.label).toBe('View Full Analysis');

      // Should have secondary actions
      expect(cardData.secondaryActions).toBeDefined();
      expect(cardData.secondaryActions!.length).toBeGreaterThan(0);
    });

    it('should include risk breakdown section', () => {
      const analysis: DocumentAnalysis = {
        documentId: 'doc-123',
        filename: 'contract.pdf',
        documentType: 'contract',
        uploadedAt: '2024-01-15T10:00:00Z',
        analyzedAt: '2024-01-15T10:01:00Z',
        entities: [],
        risks: [],
        missingTerms: [],
        blockers: [],
        riskScore: {
          overall: 30,
          grade: 'B',
          breakdown: {
            missingClauses: 10,
            unfavorableTerms: 10,
            complianceIssues: 5,
            liabilityExposure: 5
          }
        },
        summary: 'Test'
      };

      const cardData = generateCrmCardData(analysis, '123', 'http://localhost:3000');

      const breakdownSection = cardData.results.find(s => s.title === 'Risk Breakdown');
      expect(breakdownSection).toBeDefined();
      expect(breakdownSection!.properties.length).toBe(4);
    });

    it('should include insights section when risks exist', () => {
      const analysis: DocumentAnalysis = {
        documentId: 'doc-123',
        filename: 'contract.pdf',
        documentType: 'contract',
        uploadedAt: '2024-01-15T10:00:00Z',
        analyzedAt: '2024-01-15T10:01:00Z',
        entities: [],
        risks: [
          {
            id: '1',
            category: 'liability_exposure',
            severity: 'high',
            title: 'High Liability',
            description: 'Unlimited liability clause',
            recommendation: 'Negotiate cap'
          }
        ],
        missingTerms: [],
        blockers: [],
        riskScore: {
          overall: 40,
          grade: 'C',
          breakdown: {
            missingClauses: 0,
            unfavorableTerms: 0,
            complianceIssues: 0,
            liabilityExposure: 40
          }
        },
        summary: 'Test'
      };

      const cardData = generateCrmCardData(analysis, '123', 'http://localhost:3000');

      const insightsSection = cardData.results.find(s => s.title === 'Key Insights');
      expect(insightsSection).toBeDefined();
    });

    it('should include blockers section when blockers exist', () => {
      const analysis: DocumentAnalysis = {
        documentId: 'doc-123',
        filename: 'contract.pdf',
        documentType: 'contract',
        uploadedAt: '2024-01-15T10:00:00Z',
        analyzedAt: '2024-01-15T10:01:00Z',
        entities: [],
        risks: [],
        missingTerms: [],
        blockers: [
          {
            id: '1',
            type: 'missing_signature',
            title: 'Signatures Required',
            description: 'Document needs signatures',
            requiredAction: 'Obtain signatures'
          }
        ],
        riskScore: {
          overall: 20,
          grade: 'A',
          breakdown: {
            missingClauses: 0,
            unfavorableTerms: 0,
            complianceIssues: 0,
            liabilityExposure: 0
          }
        },
        summary: 'Test'
      };

      const cardData = generateCrmCardData(analysis, '123', 'http://localhost:3000');

      const blockersSection = cardData.results.find(s => s.title === 'Deal Blockers');
      expect(blockersSection).toBeDefined();
    });

    it('should limit insights to 5 items', () => {
      const analysis: DocumentAnalysis = {
        documentId: 'doc-123',
        filename: 'contract.pdf',
        documentType: 'contract',
        uploadedAt: '2024-01-15T10:00:00Z',
        analyzedAt: '2024-01-15T10:01:00Z',
        entities: [],
        risks: Array(10).fill({
          id: '1',
          category: 'missing_clause',
          severity: 'low',
          title: 'Risk',
          description: 'Desc',
          recommendation: 'Fix'
        }).map((r, i) => ({ ...r, id: String(i) })),
        missingTerms: [],
        blockers: [],
        riskScore: {
          overall: 50,
          grade: 'C',
          breakdown: {
            missingClauses: 50,
            unfavorableTerms: 0,
            complianceIssues: 0,
            liabilityExposure: 0
          }
        },
        summary: 'Test'
      };

      const cardData = generateCrmCardData(analysis, '123', 'http://localhost:3000');

      const insightsSection = cardData.results.find(s => s.title === 'Key Insights');
      expect(insightsSection!.properties.length).toBeLessThanOrEqual(5);
    });
  });
});
