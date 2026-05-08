export type ReviewPresetId =
  | 'default'
  | 'fast'
  | 'security'
  | 'quality'
  | 'ops'
  | 'docs'
  | 'release';

export interface ReviewPreset {
  id: ReviewPresetId;
  description: string;
  agents: string;
  disabledAgents?: string;
  model?: string;
  agentModels?: Record<string, string>;
}

export const PRESET_CATALOG: ReadonlyArray<ReviewPreset> = [
  {
    id: 'default',
    description: 'Review equilibrado com o perfil padrao atual.',
    agents: 'default',
  },
  {
    id: 'fast',
    description: 'Review rapido para mudancas pequenas.',
    agents: 'clean-coder,security-auditor',
  },
  {
    id: 'security',
    description: 'Auditoria focada em risco, auth, segredos e fail-open.',
    agents: 'security-auditor,error-handling-specialist,sre-agent,clean-coder',
  },
  {
    id: 'quality',
    description: 'Review focado em manutenibilidade, contratos e testes.',
    agents: 'clean-coder,test-strategist,error-handling-specialist',
  },
  {
    id: 'ops',
    description: 'Review focado em producao, resiliencia, escala e observabilidade.',
    agents: 'sre-agent,observability-engineer,scalability-architect,error-handling-specialist,security-auditor',
  },
  {
    id: 'docs',
    description: 'Review focado em documentacao e coerencia com regras locais.',
    agents: 'docs-maintainer,business-proxy',
  },
  {
    id: 'release',
    description: 'Review amplo para pre-release ou merges relevantes.',
    agents: 'all',
  },
] as const;

export const PRESET_ALIASES: Readonly<Record<string, ReviewPresetId>> = {
  quick: 'fast',
  prod: 'ops',
  full: 'release',
  all: 'release',
} as const;

const PRESET_BY_ID: ReadonlyMap<ReviewPresetId, ReviewPreset> = new Map(
  PRESET_CATALOG.map((preset) => [preset.id, preset]),
);

export function listPresetNames(): string[] {
  return [
    ...PRESET_CATALOG.map((preset) => preset.id),
    ...Object.keys(PRESET_ALIASES),
  ];
}

export function resolvePresetId(raw: string): ReviewPresetId {
  const normalized = raw.trim().toLowerCase();
  if (Object.hasOwn(PRESET_ALIASES, normalized)) {
    return PRESET_ALIASES[normalized]!;
  }

  if (PRESET_BY_ID.has(normalized as ReviewPresetId)) {
    return normalized as ReviewPresetId;
  }

  throw new Error(
    `Preset desconhecido: "${raw}". Presets validos: ${listPresetNames().join(', ')}.`,
  );
}

export function isReviewPresetName(raw: string | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  const normalized = raw.trim().toLowerCase();
  return Object.hasOwn(PRESET_ALIASES, normalized) ||
    PRESET_BY_ID.has(normalized as ReviewPresetId);
}

export function getReviewPreset(raw?: string): ReviewPreset | undefined {
  if (!raw || !raw.trim()) return undefined;
  const id = resolvePresetId(raw);
  return PRESET_BY_ID.get(id);
}
