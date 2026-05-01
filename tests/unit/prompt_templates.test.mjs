import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_TEMPLATE_NAMES,
  loadPromptTemplate,
  renderPromptTemplate,
} from '../../dist/prompts/loader.js';
import {
  SECURITY_AUDITOR_PROMPT,
  CLEAN_CODER_PROMPT,
  SRE_AGENT_PROMPT,
  BUSINESS_PROXY_PROMPT,
  ERROR_HANDLING_SPECIALIST_PROMPT,
  TEST_STRATEGIST_PROMPT,
  OBSERVABILITY_ENGINEER_PROMPT,
  DOCS_MAINTAINER_PROMPT,
  SCALABILITY_ARCHITECT_PROMPT,
  SECURITY_REVIEWER_PROMPT,
  PERFORMANCE_REVIEWER_PROMPT,
  buildArchitectConsolidatorInstruction,
} from '../../dist/prompts/index.js';

test('all prompt templates are copied to dist and readable', () => {
  for (const name of PROMPT_TEMPLATE_NAMES) {
    const template = loadPromptTemplate(name);
    assert.ok(template.length > 0, `${name} template should not be empty`);
  }
});

test('agent prompts render common evidence rules without unresolved markers', () => {
  const prompts = [
    SECURITY_AUDITOR_PROMPT,
    CLEAN_CODER_PROMPT,
    SRE_AGENT_PROMPT,
    BUSINESS_PROXY_PROMPT,
    ERROR_HANDLING_SPECIALIST_PROMPT,
    TEST_STRATEGIST_PROMPT,
    OBSERVABILITY_ENGINEER_PROMPT,
    DOCS_MAINTAINER_PROMPT,
    SCALABILITY_ARCHITECT_PROMPT,
    SECURITY_REVIEWER_PROMPT,
    PERFORMANCE_REVIEWER_PROMPT,
  ];

  for (const prompt of prompts) {
    assert.match(prompt, /Regras de evidencia/);
    assert.doesNotMatch(prompt, /\{\{EVIDENCE_RULES\}\}/);
  }
});

test('reviewer prompts preserve ADK state placeholders', () => {
  assert.match(SECURITY_REVIEWER_PROMPT, /\{performance_findings\?\}/);
  assert.match(SECURITY_REVIEWER_PROMPT, /\{quality_findings\?\}/);
  assert.match(PERFORMANCE_REVIEWER_PROMPT, /\{security_findings\?\}/);
  assert.match(PERFORMANCE_REVIEWER_PROMPT, /\{quality_findings\?\}/);
});

test('architect consolidator prompt renders scope and injected sections', () => {
  const instruction = buildArchitectConsolidatorInstruction(
    '- security_findings: []',
    '- security_critique: []',
    'DIFF_ONLY',
  );

  assert.match(instruction, /Modo DIFF_ONLY/);
  assert.match(instruction, /security_findings/);
  assert.match(instruction, /security_critique/);
  assert.doesNotMatch(instruction, /\{\{[A-Z_]+\}\}/);
});

test('prompt rendering preserves dollar tokens literally', () => {
  const section = "before $& middle $' after";
  const instruction = buildArchitectConsolidatorInstruction(
    section,
    '- security_critique: []',
    'DIFF_ONLY',
  );

  assert.match(instruction, /before \$& middle \$' after/);
});

test('prompt rendering fails fast for missing variables', () => {
  assert.throws(
    () => renderPromptTemplate('architect-consolidator', {
      REVIEW_SCOPE_RULES: 'scope',
      COUNCIL_SECTION: 'council',
    }),
    /unresolved variables: \{\{REFLECTION_SECTION\}\}/,
  );
});

test('prompt rendering does not validate placeholders injected by user-controlled sections', () => {
  const instruction = buildArchitectConsolidatorInstruction(
    '- user_diff: "{{USER_SUPPLIED_LITERAL}}"',
    '- reflection: "{{another_literal_123}}"',
    'DIFF_ONLY',
  );

  assert.match(instruction, /\{\{USER_SUPPLIED_LITERAL\}\}/);
  assert.match(instruction, /\{\{another_literal_123\}\}/);
});

test('prompt loader rejects unknown template names at runtime', () => {
  assert.throws(
    () => loadPromptTemplate('..\\package' ),
    /Unknown prompt template/,
  );
});
