import { renderPromptTemplate } from './loader.js';

export const REFLECTION_PROMPTS = {
  SECURITY_REVIEW: renderPromptTemplate('reflection-security-review'),
  PERFORMANCE_REVIEW: renderPromptTemplate('reflection-performance-review'),
  QUALITY_REVIEW: renderPromptTemplate('reflection-quality-review'),
};
