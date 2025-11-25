/**
 * Type definitions for the HubSpot Document Intelligence App
 */

/**
 * Represents an extracted entity from a document
 */
export interface ExtractedEntity {
  type: EntityType;
  value: string;
  confidence: number;
  location?: {
    page?: number;
    position?: string;
  };
}

export type EntityType =
  | 'party_name'
  | 'date'
  | 'amount'
  | 'term_duration'
  | 'payment_terms'
  | 'liability_clause'
  | 'termination_clause'
  | 'confidentiality_clause'
  | 'indemnification_clause'
  | 'governing_law'
  | 'signature'
  | 'contact_info';

/**
 * Represents a risk identified in the document
 */
export interface DocumentRisk {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  description: string;
  recommendation: string;
  relatedClauses?: string[];
}

export type RiskCategory =
  | 'missing_clause'
  | 'unfavorable_terms'
  | 'compliance_issue'
  | 'liability_exposure'
  | 'termination_risk'
  | 'payment_risk'
  | 'legal_ambiguity';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Represents a missing term or requirement
 */
export interface MissingTerm {
  term: string;
  importance: 'required' | 'recommended' | 'optional';
  description: string;
  impact: string;
}

/**
 * Represents a blocker preventing deal progress
 */
export interface DealBlocker {
  id: string;
  type: BlockerType;
  title: string;
  description: string;
  requiredAction: string;
  assignedTo?: string;
  dueDate?: string;
}

export type BlockerType =
  | 'missing_signature'
  | 'pending_approval'
  | 'legal_review'
  | 'negotiation_required'
  | 'compliance_check'
  | 'missing_document';

/**
 * Document analysis result
 */
export interface DocumentAnalysis {
  documentId: string;
  filename: string;
  documentType: DocumentType;
  uploadedAt: string;
  analyzedAt: string;
  entities: ExtractedEntity[];
  risks: DocumentRisk[];
  missingTerms: MissingTerm[];
  blockers: DealBlocker[];
  riskScore: RiskScore;
  summary: string;
  rawText?: string;
}

export type DocumentType =
  | 'contract'
  | 'nda'
  | 'proposal'
  | 'agreement'
  | 'invoice'
  | 'sow'
  | 'msa'
  | 'unknown';

/**
 * Risk score calculation result
 */
export interface RiskScore {
  overall: number; // 0-100, where 0 is lowest risk
  breakdown: {
    missingClauses: number;
    unfavorableTerms: number;
    complianceIssues: number;
    liabilityExposure: number;
  };
  grade: RiskGrade;
  trend?: 'improving' | 'stable' | 'worsening';
}

export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Required action for deal progress
 */
export interface RequiredAction {
  id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  action: string;
  reason: string;
  deadline?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * Timeline event for HubSpot integration
 */
export interface TimelineEvent {
  eventTemplateId: string;
  objectId: string;
  tokens: Record<string, string>;
  extraData?: Record<string, unknown>;
}

/**
 * CRM Card data structure
 */
export interface CrmCardData {
  results: CrmCardSection[];
  primaryAction?: CrmCardAction;
  secondaryActions?: CrmCardAction[];
}

export interface CrmCardSection {
  objectId: number;
  title: string;
  properties: CrmCardProperty[];
  actions?: CrmCardAction[];
}

export interface CrmCardProperty {
  label: string;
  dataType: 'STRING' | 'NUMBER' | 'DATE' | 'CURRENCY' | 'LINK' | 'STATUS';
  value: string | number;
}

export interface CrmCardAction {
  type: 'IFRAME' | 'ACTION_HOOK' | 'CONFIRMATION_ACTION_HOOK';
  width: number;
  height: number;
  uri: string;
  label: string;
  associatedObjectProperties?: string[];
}

/**
 * OAuth token storage
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  portalId?: string;
}

/**
 * API Response types
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Document upload request
 */
export interface DocumentUploadRequest {
  dealId: string;
  filename: string;
  mimeType: string;
}

/**
 * Parsed document content
 */
export interface ParsedDocument {
  text: string;
  pages: number;
  metadata: Record<string, string>;
  confidence: number;
}
