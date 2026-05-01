import { AnalysisMode } from '../schemas/contracts.js';
import { renderPromptTemplate, type PromptTemplateName } from './loader.js';

const EVIDENCE_RULES = renderPromptTemplate('evidence-rules');

function renderAgentPrompt(name: PromptTemplateName): string {
  return renderPromptTemplate(name, { EVIDENCE_RULES });
}

export const SECURITY_AUDITOR_PROMPT = renderAgentPrompt('security-auditor');
export const CLEAN_CODER_PROMPT = renderAgentPrompt('clean-coder');
export const SRE_AGENT_PROMPT = renderAgentPrompt('sre-agent');
export const BUSINESS_PROXY_PROMPT = renderAgentPrompt('business-proxy');
export const ERROR_HANDLING_SPECIALIST_PROMPT = renderAgentPrompt('error-handling-specialist');
export const TEST_STRATEGIST_PROMPT = renderAgentPrompt('test-strategist');
export const OBSERVABILITY_ENGINEER_PROMPT = renderAgentPrompt('observability-engineer');
export const DOCS_MAINTAINER_PROMPT = renderAgentPrompt('docs-maintainer');
export const SCALABILITY_ARCHITECT_PROMPT = renderAgentPrompt('scalability-architect');
export const SECURITY_REVIEWER_PROMPT = renderAgentPrompt('security-reviewer');
export const PERFORMANCE_REVIEWER_PROMPT = renderAgentPrompt('performance-reviewer');

const reviewScopeTemplateByMode: Record<AnalysisMode, PromptTemplateName> = {
  DIFF_ONLY: 'review-scope-diff-only',
  DIFF_WITH_CONTEXT: 'review-scope-diff-with-context',
  FULL_FILE: 'review-scope-full-file',
};

export function buildArchitectConsolidatorInstruction(
  councilSection: string,
  reflectionSection: string,
  analysisMode: AnalysisMode = 'DIFF_WITH_CONTEXT',
): string {
  return renderPromptTemplate('architect-consolidator', {
    REVIEW_SCOPE_RULES: renderPromptTemplate(reviewScopeTemplateByMode[analysisMode]),
    COUNCIL_SECTION: councilSection,
    REFLECTION_SECTION: reflectionSection,
  });
}
