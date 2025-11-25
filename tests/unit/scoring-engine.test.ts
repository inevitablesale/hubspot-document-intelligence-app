/**
 * Unit tests for the scoring engine service
 */

import {
  calculateRiskScore,
  generateRequiredActions,
  getRiskScoreColor,
  formatRiskScore
} from '../../src/services/scoring-engine.service';
import { DocumentRisk, MissingTerm, DealBlocker, RiskScore } from '../../src/types';

describe('Scoring Engine Service', () => {
  describe('calculateRiskScore', () => {
    it('should return low risk score with no risks', () => {
      const risks: DocumentRisk[] = [];
      const missingTerms: MissingTerm[] = [];
      const blockers: DealBlocker[] = [];

      const score = calculateRiskScore(risks, missingTerms, blockers);

      expect(score.overall).toBe(0);
      expect(score.grade).toBe('A');
    });

    it('should calculate score from risks', () => {
      const risks: DocumentRisk[] = [
        {
          id: '1',
          category: 'missing_clause',
          severity: 'medium',
          title: 'Missing Termination',
          description: 'No termination clause',
          recommendation: 'Add clause'
        }
      ];
      const missingTerms: MissingTerm[] = [];
      const blockers: DealBlocker[] = [];

      const score = calculateRiskScore(risks, missingTerms, blockers);

      expect(score.overall).toBeGreaterThan(0);
      expect(score.breakdown.missingClauses).toBeGreaterThan(0);
    });

    it('should add penalty for missing terms', () => {
      const risks: DocumentRisk[] = [];
      const missingTerms: MissingTerm[] = [
        {
          term: 'Effective Date',
          importance: 'required',
          description: 'Missing effective date',
          impact: 'Document may be invalid'
        }
      ];
      const blockers: DealBlocker[] = [];

      const score = calculateRiskScore(risks, missingTerms, blockers);

      expect(score.overall).toBeGreaterThan(0);
    });

    it('should add penalty for blockers', () => {
      const risks: DocumentRisk[] = [];
      const missingTerms: MissingTerm[] = [];
      const blockers: DealBlocker[] = [
        {
          id: '1',
          type: 'missing_signature',
          title: 'Signature Required',
          description: 'Document needs signature',
          requiredAction: 'Get signatures'
        }
      ];

      const score = calculateRiskScore(risks, missingTerms, blockers);

      expect(score.overall).toBeGreaterThan(0);
    });

    it('should return correct grade for different scores', () => {
      // Test grade A (0-20)
      const lowRisks: DocumentRisk[] = [];
      let score = calculateRiskScore(lowRisks, [], []);
      expect(score.grade).toBe('A');

      // Test higher scores by adding critical risks
      const criticalRisks: DocumentRisk[] = [
        {
          id: '1',
          category: 'liability_exposure',
          severity: 'critical',
          title: 'Critical Issue',
          description: 'Major liability',
          recommendation: 'Fix immediately'
        },
        {
          id: '2',
          category: 'liability_exposure',
          severity: 'critical',
          title: 'Critical Issue 2',
          description: 'Major liability',
          recommendation: 'Fix immediately'
        },
        {
          id: '3',
          category: 'liability_exposure',
          severity: 'critical',
          title: 'Critical Issue 3',
          description: 'Major liability',
          recommendation: 'Fix immediately'
        }
      ];

      score = calculateRiskScore(criticalRisks, [], []);
      expect(['C', 'D', 'F']).toContain(score.grade);
    });

    it('should cap overall score at 100', () => {
      const manyRisks: DocumentRisk[] = Array(20).fill({
        id: '1',
        category: 'liability_exposure',
        severity: 'critical',
        title: 'Risk',
        description: 'Desc',
        recommendation: 'Fix'
      }).map((r, i) => ({ ...r, id: String(i) }));

      const score = calculateRiskScore(manyRisks, [], []);

      expect(score.overall).toBeLessThanOrEqual(100);
    });
  });

  describe('generateRequiredActions', () => {
    it('should generate actions from critical risks', () => {
      const risks: DocumentRisk[] = [
        {
          id: '1',
          category: 'liability_exposure',
          severity: 'critical',
          title: 'Critical Risk',
          description: 'Major issue',
          recommendation: 'Fix now'
        }
      ];

      const actions = generateRequiredActions(risks, [], []);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].priority).toBe('urgent');
    });

    it('should generate actions from blockers', () => {
      const blockers: DealBlocker[] = [
        {
          id: '1',
          type: 'missing_signature',
          title: 'Signature',
          description: 'Need signature',
          requiredAction: 'Get signed'
        }
      ];

      const actions = generateRequiredActions([], [], blockers);

      expect(actions.length).toBeGreaterThan(0);
    });

    it('should sort actions by priority', () => {
      const risks: DocumentRisk[] = [
        {
          id: '1',
          category: 'missing_clause',
          severity: 'medium',
          title: 'Medium Risk',
          description: 'Issue',
          recommendation: 'Fix'
        }
      ];
      const blockers: DealBlocker[] = [
        {
          id: '1',
          type: 'missing_signature',
          title: 'Urgent',
          description: 'Need now',
          requiredAction: 'Sign'
        }
      ];

      const actions = generateRequiredActions(risks, [], blockers);

      expect(actions[0].priority).toBe('urgent');
    });
  });

  describe('getRiskScoreColor', () => {
    it('should return green for grade A', () => {
      expect(getRiskScoreColor('A')).toBe('#00875A');
    });

    it('should return red for grade F', () => {
      expect(getRiskScoreColor('F')).toBe('#DE350B');
    });
  });

  describe('formatRiskScore', () => {
    it('should format score correctly', () => {
      const score: RiskScore = {
        overall: 25,
        grade: 'B',
        breakdown: {
          missingClauses: 10,
          unfavorableTerms: 5,
          complianceIssues: 5,
          liabilityExposure: 5
        }
      };

      const formatted = formatRiskScore(score);

      expect(formatted).toBe('B (75% safe)');
    });
  });
});
