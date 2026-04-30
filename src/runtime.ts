import { getDefaultModel } from './config.js';
import { AgentModelMap } from './agents/agent_parser.js';
import { AnalysisMode, AnalysisPayload } from './schemas/contracts.js';

export type AnalysisRuntimeRequest = Pick<AnalysisPayload, 'metadata' | 'diff' | 'sourceCode'>;

export function resolveAnalysisMode(request: AnalysisRuntimeRequest): AnalysisMode {
  if (request.metadata?.analysisMode) return request.metadata.analysisMode;
  if (!request.diff && request.sourceCode) return 'FULL_FILE';
  if (request.diff && request.sourceCode) return 'DIFF_WITH_CONTEXT';
  return 'DIFF_ONLY';
}

export function withResolvedAnalysisMode<T extends AnalysisPayload>(request: T): T {
  const analysisMode = resolveAnalysisMode(request);
  return {
    ...request,
    metadata: {
      ...request.metadata,
      analysisMode,
    },
  };
}

export function resolveRuntimeModel(opts: {
  explicitModel?: string;
  request?: Pick<AnalysisPayload, 'metadata'>;
} = {}): string {
  return opts.explicitModel || opts.request?.metadata?.model || getDefaultModel();
}

export function getPayloadAgentModels(request: Pick<AnalysisPayload, 'metadata'>): AgentModelMap | undefined {
  if (!request.metadata?.agentModels) return undefined;
  return new Map(Object.entries(request.metadata.agentModels));
}
