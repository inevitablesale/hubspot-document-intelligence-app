/**
 * AI Parsing Service
 * Uses OpenAI to extract entities, risks, and insights from documents
 */

import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { config } from '../config';
import {
  ExtractedEntity,
  DocumentRisk,
  MissingTerm,
  DealBlocker,
  RiskCategory,
  RiskSeverity,
  BlockerType,
  EntityType
} from '../types';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }
  return openaiClient;
}

/**
 * Extract entities from document text using AI
 */
export async function extractEntities(text: string): Promise<ExtractedEntity[]> {
  if (!config.openai.apiKey) {
    return extractEntitiesWithPatterns(text);
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a legal document analyzer. Extract key entities from the document text.
Return a JSON array of entities with this structure:
[{"type": "party_name|date|amount|term_duration|payment_terms|liability_clause|termination_clause|confidentiality_clause|indemnification_clause|governing_law|signature|contact_info", "value": "extracted value", "confidence": 0.0-1.0}]
Only include entities you find with reasonable confidence.`
        },
        {
          role: 'user',
          content: `Extract entities from this document:\n\n${text.substring(0, 8000)}`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return parsed.entities || parsed;
    }
  } catch (error) {
    console.error('AI entity extraction failed, using pattern matching:', error);
  }

  return extractEntitiesWithPatterns(text);
}

/**
 * Pattern-based entity extraction (fallback)
 */
function extractEntitiesWithPatterns(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Date patterns
  const datePatterns = [
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g,
    /\b(\d{1,2}-\d{1,2}-\d{2,4})\b/g,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi
  ];

  for (const pattern of datePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      entities.push({
        type: 'date',
        value: match[1],
        confidence: 0.8
      });
    }
  }

  // Amount patterns
  const amountPattern = /\$[\d,]+(?:\.\d{2})?/g;
  const amountMatches = text.matchAll(amountPattern);
  for (const match of amountMatches) {
    entities.push({
      type: 'amount',
      value: match[0],
      confidence: 0.9
    });
  }

  // Term duration patterns
  const termPatterns = [
    /(?:term|duration|period)\s+(?:of\s+)?(\d+)\s+(years?|months?|days?)/gi,
    /(\d+)\s*(year|month|day)\s*(?:term|agreement|contract)/gi
  ];

  for (const pattern of termPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      entities.push({
        type: 'term_duration',
        value: match[0],
        confidence: 0.7
      });
    }
  }

  return entities;
}

/**
 * Identify risks in document text using AI
 */
export async function identifyRisks(text: string, documentType: string): Promise<DocumentRisk[]> {
  if (!config.openai.apiKey) {
    return identifyRisksWithRules(text, documentType);
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a legal risk analyst. Analyze the ${documentType} document for potential risks.
Return a JSON object with "risks" array containing:
[{"category": "missing_clause|unfavorable_terms|compliance_issue|liability_exposure|termination_risk|payment_risk|legal_ambiguity", "severity": "low|medium|high|critical", "title": "brief title", "description": "detailed description", "recommendation": "suggested action", "relatedClauses": ["optional clause references"]}]`
        },
        {
          role: 'user',
          content: `Analyze this ${documentType} for risks:\n\n${text.substring(0, 8000)}`
        }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const risks = parsed.risks || [];
      return risks.map((r: DocumentRisk) => ({
        ...r,
        id: randomUUID()
      }));
    }
  } catch (error) {
    console.error('AI risk identification failed, using rules:', error);
  }

  return identifyRisksWithRules(text, documentType);
}

/**
 * Rule-based risk identification (fallback)
 */
function identifyRisksWithRules(text: string, documentType: string): DocumentRisk[] {
  const risks: DocumentRisk[] = [];
  const lowerText = text.toLowerCase();

  // Check for missing standard clauses
  const standardClauses = [
    { name: 'termination', keywords: ['termination', 'terminate', 'cancellation'] },
    { name: 'liability', keywords: ['liability', 'limitation of liability', 'damages'] },
    { name: 'indemnification', keywords: ['indemnify', 'indemnification', 'hold harmless'] },
    { name: 'confidentiality', keywords: ['confidential', 'proprietary', 'non-disclosure'] },
    { name: 'governing law', keywords: ['governing law', 'jurisdiction', 'venue'] }
  ];

  for (const clause of standardClauses) {
    const found = clause.keywords.some(kw => lowerText.includes(kw));
    if (!found) {
      risks.push({
        id: randomUUID(),
        category: 'missing_clause',
        severity: 'medium',
        title: `Missing ${clause.name} clause`,
        description: `The document does not appear to contain a ${clause.name} clause.`,
        recommendation: `Add a ${clause.name} clause to protect your interests.`
      });
    }
  }

  // Check for unfavorable terms
  const unfavorablePatterns = [
    { pattern: /unlimited liability/i, title: 'Unlimited Liability', severity: 'high' as RiskSeverity },
    { pattern: /waive.*rights?/i, title: 'Rights Waiver', severity: 'medium' as RiskSeverity },
    { pattern: /automatic renewal/i, title: 'Auto-Renewal', severity: 'low' as RiskSeverity },
    { pattern: /non-compete/i, title: 'Non-Compete Clause', severity: 'medium' as RiskSeverity }
  ];

  for (const { pattern, title, severity } of unfavorablePatterns) {
    if (pattern.test(text)) {
      risks.push({
        id: randomUUID(),
        category: 'unfavorable_terms',
        severity,
        title,
        description: `The document contains ${title.toLowerCase()} language that may be unfavorable.`,
        recommendation: `Review and potentially negotiate the ${title.toLowerCase()} terms.`
      });
    }
  }

  return risks;
}

/**
 * Identify missing terms in a document
 */
export async function identifyMissingTerms(
  text: string,
  documentType: string
): Promise<MissingTerm[]> {
  const missingTerms: MissingTerm[] = [];
  const lowerText = text.toLowerCase();

  // Define required terms by document type
  const requiredTermsByType: Record<string, Array<{ term: string; keywords: string[] }>> = {
    contract: [
      { term: 'Effective Date', keywords: ['effective date', 'commencement date', 'start date'] },
      { term: 'Term Duration', keywords: ['term', 'duration', 'period'] },
      { term: 'Payment Terms', keywords: ['payment', 'compensation', 'fee', 'price'] },
      { term: 'Termination Clause', keywords: ['termination', 'terminate', 'cancel'] },
      { term: 'Signatures', keywords: ['signature', 'signed', 'executed'] }
    ],
    nda: [
      { term: 'Definition of Confidential Information', keywords: ['confidential information', 'proprietary information'] },
      { term: 'Obligations of Receiving Party', keywords: ['receiving party', 'recipient'] },
      { term: 'Term of Confidentiality', keywords: ['term', 'duration', 'period'] },
      { term: 'Permitted Disclosures', keywords: ['permitted disclosure', 'exceptions'] }
    ],
    proposal: [
      { term: 'Scope of Work', keywords: ['scope', 'deliverables', 'services'] },
      { term: 'Timeline', keywords: ['timeline', 'schedule', 'milestones'] },
      { term: 'Pricing', keywords: ['price', 'cost', 'fee', 'investment'] },
      { term: 'Terms and Conditions', keywords: ['terms', 'conditions'] }
    ]
  };

  const requiredTerms = requiredTermsByType[documentType] || requiredTermsByType.contract;

  for (const { term, keywords } of requiredTerms) {
    const found = keywords.some(kw => lowerText.includes(kw));
    if (!found) {
      missingTerms.push({
        term,
        importance: 'required',
        description: `The document is missing a ${term} section.`,
        impact: `Without ${term}, the document may be incomplete or unenforceable.`
      });
    }
  }

  return missingTerms;
}

/**
 * Identify deal blockers from document analysis
 */
export async function identifyBlockers(
  text: string,
  risks: DocumentRisk[],
  missingTerms: MissingTerm[]
): Promise<DealBlocker[]> {
  const blockers: DealBlocker[] = [];
  const lowerText = text.toLowerCase();

  // Check for missing signatures
  if (!lowerText.includes('signature') && !lowerText.includes('signed by')) {
    blockers.push({
      id: randomUUID(),
      type: 'missing_signature',
      title: 'Signatures Required',
      description: 'The document requires signatures to be legally binding.',
      requiredAction: 'Obtain signatures from all parties.'
    });
  }

  // Create blockers from critical risks
  const criticalRisks = risks.filter(r => r.severity === 'critical');
  for (const risk of criticalRisks) {
    blockers.push({
      id: randomUUID(),
      type: 'legal_review',
      title: `Critical Risk: ${risk.title}`,
      description: risk.description,
      requiredAction: risk.recommendation
    });
  }

  // Create blockers from missing required terms
  const requiredMissing = missingTerms.filter(t => t.importance === 'required');
  for (const term of requiredMissing) {
    blockers.push({
      id: randomUUID(),
      type: 'negotiation_required',
      title: `Missing: ${term.term}`,
      description: term.description,
      requiredAction: `Add ${term.term} to the document.`
    });
  }

  return blockers;
}

/**
 * Generate a summary of the document
 */
export async function generateSummary(
  text: string,
  documentType: string
): Promise<string> {
  if (!config.openai.apiKey) {
    return generateBasicSummary(text, documentType);
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a legal document summarizer. Provide a concise 2-3 sentence summary of the document, highlighting key terms and parties involved.'
        },
        {
          role: 'user',
          content: `Summarize this ${documentType}:\n\n${text.substring(0, 4000)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });

    return response.choices[0]?.message?.content || generateBasicSummary(text, documentType);
  } catch (error) {
    console.error('AI summary generation failed:', error);
    return generateBasicSummary(text, documentType);
  }
}

/**
 * Basic summary generation (fallback)
 */
function generateBasicSummary(text: string, documentType: string): string {
  const wordCount = text.split(/\s+/).length;
  const firstParagraph = text.split('\n\n')[0]?.substring(0, 200) || '';
  
  return `This is a ${documentType} document containing approximately ${wordCount} words. ${firstParagraph}...`;
}
