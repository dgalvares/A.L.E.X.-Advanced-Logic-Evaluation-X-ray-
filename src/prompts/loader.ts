import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROMPT_TEMPLATE_NAMES = [
  'evidence-rules',
  'security-auditor',
  'clean-coder',
  'sre-agent',
  'business-proxy',
  'error-handling-specialist',
  'test-strategist',
  'observability-engineer',
  'docs-maintainer',
  'scalability-architect',
  'security-reviewer',
  'performance-reviewer',
  'architect-consolidator',
  'review-scope-diff-only',
  'review-scope-diff-with-context',
  'review-scope-full-file',
  'reflection-security-review',
  'reflection-performance-review',
  'reflection-quality-review',
] as const;

export type PromptTemplateName = typeof PROMPT_TEMPLATE_NAMES[number];

const validTemplateNames = new Set<string>(PROMPT_TEMPLATE_NAMES);
const templateCache = new Map<PromptTemplateName, string>();
const templateDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'templates',
);

export function loadPromptTemplate(name: PromptTemplateName): string {
  if (!validTemplateNames.has(name)) {
    throw new Error(`Unknown prompt template: ${String(name)}`);
  }

  const cachedTemplate = templateCache.get(name);
  if (cachedTemplate !== undefined) {
    return cachedTemplate;
  }

  const filePath = path.join(templateDir, `${name}.md`);

  try {
    const template = normalizeTemplate(fs.readFileSync(filePath, 'utf8'));
    templateCache.set(name, template);
    return template;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error(`Prompt template not found: ${filePath}`);
    }

    throw error;
  }
}

export function prewarmPromptTemplates(): void {
  for (const name of PROMPT_TEMPLATE_NAMES) {
    loadPromptTemplate(name);
  }
}

export function renderPromptTemplate(
  name: PromptTemplateName,
  variables: Record<string, string> = {},
): string {
  const template = loadPromptTemplate(name);
  const unresolvedPlaceholders = [...template.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)]
    .map((match) => ({
      token: match[0],
      key: match[1],
    }))
    .filter(({ key }) => !Object.hasOwn(variables, key));

  if (unresolvedPlaceholders.length > 0) {
    throw new Error(
      `Prompt template ${name} has unresolved variables: ${[...new Set(unresolvedPlaceholders.map(({ token }) => token))].join(', ')}`,
    );
  }

  let renderedTemplate = template;

  for (const [key, value] of Object.entries(variables)) {
    renderedTemplate = renderedTemplate.replaceAll(`{{${key}}}`, () => value);
  }

  return renderedTemplate.trim();
}

function normalizeTemplate(template: string): string {
  return template.replace(/\r\n/g, '\n').trim();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

prewarmPromptTemplates();
