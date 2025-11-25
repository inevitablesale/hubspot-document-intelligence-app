/**
 * CRM Card Service
 * Generates HubSpot CRM card data for displaying document intelligence
 */

import { Client } from '@hubspot/api-client';
import {
  DocumentAnalysis,
  CrmCardData,
  CrmCardSection,
  CrmCardProperty,
  CrmCardAction,
  RequiredAction
} from '../types';
import {
  getRiskScoreColor,
  generateRequiredActions
} from './scoring-engine.service';
import { getHubSpotClient } from './oauth.service';

/**
 * Generate CRM card data for a deal's document analysis
 */
export function generateCrmCardData(
  analysis: DocumentAnalysis | null,
  dealId: string,
  baseUrl: string
): CrmCardData {
  if (!analysis) {
    return {
      results: [{
        objectId: parseInt(dealId, 10),
        title: 'Document Intelligence',
        properties: [
          {
            label: 'Status',
            dataType: 'STRING',
            value: 'No documents analyzed'
          }
        ],
        actions: [{
          type: 'IFRAME',
          width: 800,
          height: 600,
          uri: `${baseUrl}/upload?dealId=${dealId}`,
          label: 'Upload Document'
        }]
      }]
    };
  }

  const requiredActions = generateRequiredActions(
    analysis.risks,
    analysis.missingTerms,
    analysis.blockers
  );

  const sections: CrmCardSection[] = [];

  // Main risk score section
  sections.push({
    objectId: parseInt(analysis.documentId, 10) || 1,
    title: 'Document Risk Score',
    properties: [
      {
        label: 'Risk Grade',
        dataType: 'STATUS',
        value: analysis.riskScore.grade
      },
      {
        label: 'Overall Score',
        dataType: 'NUMBER',
        value: 100 - analysis.riskScore.overall
      },
      {
        label: 'Document Type',
        dataType: 'STRING',
        value: formatDocumentType(analysis.documentType)
      },
      {
        label: 'Analyzed',
        dataType: 'DATE',
        value: analysis.analyzedAt
      }
    ]
  });

  // Risk breakdown section
  sections.push({
    objectId: 2,
    title: 'Risk Breakdown',
    properties: [
      {
        label: 'Missing Clauses',
        dataType: 'NUMBER',
        value: analysis.riskScore.breakdown.missingClauses
      },
      {
        label: 'Unfavorable Terms',
        dataType: 'NUMBER',
        value: analysis.riskScore.breakdown.unfavorableTerms
      },
      {
        label: 'Compliance Issues',
        dataType: 'NUMBER',
        value: analysis.riskScore.breakdown.complianceIssues
      },
      {
        label: 'Liability Exposure',
        dataType: 'NUMBER',
        value: analysis.riskScore.breakdown.liabilityExposure
      }
    ]
  });

  // Insights section
  if (analysis.risks.length > 0) {
    sections.push({
      objectId: 3,
      title: 'Key Insights',
      properties: analysis.risks.slice(0, 5).map((risk, index) => ({
        label: `${risk.severity.toUpperCase()}: ${risk.title}`,
        dataType: 'STRING' as const,
        value: risk.description
      }))
    });
  }

  // Required actions section
  if (requiredActions.length > 0) {
    sections.push({
      objectId: 4,
      title: 'Required Actions',
      properties: requiredActions.slice(0, 5).map(action => ({
        label: `[${action.priority.toUpperCase()}]`,
        dataType: 'STRING' as const,
        value: action.action
      }))
    });
  }

  // Blockers section
  if (analysis.blockers.length > 0) {
    sections.push({
      objectId: 5,
      title: 'Deal Blockers',
      properties: analysis.blockers.map(blocker => ({
        label: blocker.title,
        dataType: 'STRING' as const,
        value: blocker.requiredAction
      }))
    });
  }

  return {
    results: sections,
    primaryAction: {
      type: 'IFRAME',
      width: 900,
      height: 700,
      uri: `${baseUrl}/documents/${analysis.documentId}/details`,
      label: 'View Full Analysis'
    },
    secondaryActions: [
      {
        type: 'IFRAME',
        width: 800,
        height: 600,
        uri: `${baseUrl}/upload?dealId=${dealId}`,
        label: 'Upload New Document'
      },
      {
        type: 'ACTION_HOOK',
        width: 400,
        height: 300,
        uri: `${baseUrl}/api/documents/${analysis.documentId}/reanalyze`,
        label: 'Re-analyze Document'
      }
    ]
  };
}

/**
 * Format document type for display
 */
function formatDocumentType(type: string): string {
  const typeMap: Record<string, string> = {
    contract: 'Contract',
    nda: 'NDA',
    proposal: 'Proposal',
    agreement: 'Agreement',
    invoice: 'Invoice',
    sow: 'Statement of Work',
    msa: 'Master Service Agreement',
    unknown: 'Document'
  };
  return typeMap[type] || type;
}

/**
 * Create timeline event for document analysis
 */
export async function createTimelineEvent(
  portalId: string,
  dealId: string,
  analysis: DocumentAnalysis,
  eventTemplateId: string
): Promise<void> {
  const client = await getHubSpotClient(portalId);
  if (!client) {
    throw new Error('HubSpot client not authenticated');
  }

  const tokens = {
    documentName: analysis.filename,
    documentType: formatDocumentType(analysis.documentType),
    riskGrade: analysis.riskScore.grade,
    riskScore: String(100 - analysis.riskScore.overall),
    summary: analysis.summary,
    risksCount: String(analysis.risks.length),
    blockersCount: String(analysis.blockers.length)
  };

  await client.crm.timeline.eventsApi.create({
    eventTemplateId,
    objectId: dealId,
    tokens,
    extraData: {
      analysis: {
        documentId: analysis.documentId,
        risks: analysis.risks,
        missingTerms: analysis.missingTerms,
        blockers: analysis.blockers
      }
    }
  });
}

/**
 * Generate timeline event template
 */
export function getTimelineEventTemplate(): object {
  return {
    name: 'Document Analysis Complete',
    headerTemplate: '{{documentName}} analyzed - Risk Grade: {{riskGrade}}',
    detailTemplate: `
      <p><strong>Document:</strong> {{documentName}} ({{documentType}})</p>
      <p><strong>Risk Score:</strong> {{riskScore}}/100</p>
      <p><strong>Summary:</strong> {{summary}}</p>
      <p><strong>Risks Found:</strong> {{risksCount}}</p>
      <p><strong>Blockers:</strong> {{blockersCount}}</p>
    `,
    tokens: [
      { name: 'documentName', type: 'string', label: 'Document Name' },
      { name: 'documentType', type: 'string', label: 'Document Type' },
      { name: 'riskGrade', type: 'string', label: 'Risk Grade' },
      { name: 'riskScore', type: 'string', label: 'Risk Score' },
      { name: 'summary', type: 'string', label: 'Summary' },
      { name: 'risksCount', type: 'string', label: 'Risks Count' },
      { name: 'blockersCount', type: 'string', label: 'Blockers Count' }
    ]
  };
}
