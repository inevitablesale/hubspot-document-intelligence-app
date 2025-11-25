/**
 * Document Risk Scoring Engine
 * Calculates risk scores based on document analysis
 */

import { randomUUID } from 'crypto';
import {
  DocumentAnalysis,
  DocumentRisk,
  MissingTerm,
  DealBlocker,
  RiskScore,
  RiskGrade,
  RequiredAction,
  ExtractedEntity,
  DocumentType
} from '../types';
import {
  extractEntities,
  identifyRisks,
  identifyMissingTerms,
  identifyBlockers,
  generateSummary
} from './ai-parsing.service';
import {
  ingestDocument,
  detectDocumentType
} from './document-ingestion.service';

/**
 * Weight factors for different risk categories
 */
const RISK_WEIGHTS = {
  missing_clause: 15,
  unfavorable_terms: 20,
  compliance_issue: 25,
  liability_exposure: 30,
  termination_risk: 15,
  payment_risk: 20,
  legal_ambiguity: 10
};

/**
 * Severity multipliers
 */
const SEVERITY_MULTIPLIERS = {
  low: 0.25,
  medium: 0.5,
  high: 0.75,
  critical: 1.0
};

/**
 * Calculate the overall risk score from identified risks
 */
export function calculateRiskScore(
  risks: DocumentRisk[],
  missingTerms: MissingTerm[],
  blockers: DealBlocker[]
): RiskScore {
  let totalScore = 0;
  const breakdown = {
    missingClauses: 0,
    unfavorableTerms: 0,
    complianceIssues: 0,
    liabilityExposure: 0
  };

  // Calculate risk-based scores
  for (const risk of risks) {
    const weight = RISK_WEIGHTS[risk.category] || 10;
    const multiplier = SEVERITY_MULTIPLIERS[risk.severity];
    const riskScore = weight * multiplier;

    totalScore += riskScore;

    // Update breakdown
    switch (risk.category) {
      case 'missing_clause':
        breakdown.missingClauses += riskScore;
        break;
      case 'unfavorable_terms':
      case 'termination_risk':
      case 'payment_risk':
        breakdown.unfavorableTerms += riskScore;
        break;
      case 'compliance_issue':
      case 'legal_ambiguity':
        breakdown.complianceIssues += riskScore;
        break;
      case 'liability_exposure':
        breakdown.liabilityExposure += riskScore;
        break;
    }
  }

  // Add penalty for missing terms
  for (const term of missingTerms) {
    const penalty = term.importance === 'required' ? 10 : term.importance === 'recommended' ? 5 : 2;
    totalScore += penalty;
    breakdown.missingClauses += penalty;
  }

  // Add penalty for blockers
  totalScore += blockers.length * 5;

  // Normalize to 0-100 scale
  const normalizedScore = Math.min(100, Math.round(totalScore));

  return {
    overall: normalizedScore,
    breakdown: {
      missingClauses: Math.min(25, Math.round(breakdown.missingClauses)),
      unfavorableTerms: Math.min(25, Math.round(breakdown.unfavorableTerms)),
      complianceIssues: Math.min(25, Math.round(breakdown.complianceIssues)),
      liabilityExposure: Math.min(25, Math.round(breakdown.liabilityExposure))
    },
    grade: calculateGrade(normalizedScore)
  };
}

/**
 * Calculate risk grade from score
 */
function calculateGrade(score: number): RiskGrade {
  if (score <= 20) return 'A';
  if (score <= 40) return 'B';
  if (score <= 60) return 'C';
  if (score <= 80) return 'D';
  return 'F';
}

/**
 * Generate required actions from analysis
 */
export function generateRequiredActions(
  risks: DocumentRisk[],
  missingTerms: MissingTerm[],
  blockers: DealBlocker[]
): RequiredAction[] {
  const actions: RequiredAction[] = [];

  // Actions from critical/high risks
  for (const risk of risks.filter(r => r.severity === 'critical' || r.severity === 'high')) {
    actions.push({
      id: randomUUID(),
      priority: risk.severity === 'critical' ? 'urgent' : 'high',
      action: risk.recommendation,
      reason: risk.description,
      status: 'pending'
    });
  }

  // Actions from blockers
  for (const blocker of blockers) {
    const priority = blocker.type === 'missing_signature' ? 'urgent' : 'high';
    actions.push({
      id: randomUUID(),
      priority,
      action: blocker.requiredAction,
      reason: blocker.description,
      status: 'pending'
    });
  }

  // Actions from required missing terms
  for (const term of missingTerms.filter(t => t.importance === 'required')) {
    actions.push({
      id: randomUUID(),
      priority: 'medium',
      action: `Add ${term.term} to the document`,
      reason: term.impact,
      status: 'pending'
    });
  }

  // Sort by priority
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return actions;
}

/**
 * Perform complete document analysis
 */
export async function analyzeDocument(
  filePath: string,
  filename: string,
  mimeType: string,
  documentId?: string
): Promise<DocumentAnalysis> {
  // Ingest document
  const parsed = await ingestDocument(filePath, mimeType);

  // Detect document type
  const documentType = detectDocumentType(parsed.text, filename);

  // Extract entities
  const entities = await extractEntities(parsed.text);

  // Identify risks
  const risks = await identifyRisks(parsed.text, documentType);

  // Identify missing terms
  const missingTerms = await identifyMissingTerms(parsed.text, documentType);

  // Identify blockers
  const blockers = await identifyBlockers(parsed.text, risks, missingTerms);

  // Calculate risk score
  const riskScore = calculateRiskScore(risks, missingTerms, blockers);

  // Generate summary
  const summary = await generateSummary(parsed.text, documentType);

  return {
    documentId: documentId || randomUUID(),
    filename,
    documentType,
    uploadedAt: new Date().toISOString(),
    analyzedAt: new Date().toISOString(),
    entities,
    risks,
    missingTerms,
    blockers,
    riskScore,
    summary,
    rawText: parsed.text.substring(0, 5000) // Store first 5000 chars
  };
}

/**
 * Get risk score color for display
 */
export function getRiskScoreColor(grade: RiskGrade): string {
  const colors: Record<RiskGrade, string> = {
    A: '#00875A', // Green
    B: '#36B37E', // Light green
    C: '#FFAB00', // Yellow
    D: '#FF8B00', // Orange
    F: '#DE350B' // Red
  };
  return colors[grade];
}

/**
 * Get risk severity label
 */
export function getRiskSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical Risk'
  };
  return labels[severity] || severity;
}

/**
 * Format risk score for display
 */
export function formatRiskScore(score: RiskScore): string {
  return `${score.grade} (${100 - score.overall}% safe)`;
}
