import { AgentId } from './catalog.js';
import { resolveAgentIds } from './agent_parser.js';
import { getReviewPreset, isReviewPresetName, ReviewPreset } from './presets.js';

export interface AgentProfileResolutionInput {
  agents?: string;
  disabledAgents?: string;
  preset?: string;
  envAgents?: string;
  envDisabledAgents?: string;
  envPreset?: string;
}

export interface AgentProfileResolution {
  enabledAgents: AgentId[];
  preset?: ReviewPreset;
}

export interface ReviewProfileShortcutResolution {
  agents?: string;
  preset?: string;
}

export function resolveReviewProfileShortcut(
  profile: string | undefined,
  opts: { agents?: string; preset?: string } = {},
): ReviewProfileShortcutResolution {
  if (!profile || opts.agents !== undefined || opts.preset !== undefined) {
    return { agents: opts.agents, preset: opts.preset };
  }

  if (isReviewPresetName(profile)) {
    return { agents: undefined, preset: profile };
  }

  return { agents: profile, preset: undefined };
}

export function resolveAgentProfile(input: AgentProfileResolutionInput = {}): AgentProfileResolution {
  const hasExplicitAgents = input.agents !== undefined;
  const hasExplicitPreset = input.preset !== undefined;
  const hasEnvAgents = input.envAgents !== undefined;

  const preset = hasExplicitAgents
    ? undefined
    : getReviewPreset(hasExplicitPreset ? input.preset : (hasEnvAgents ? undefined : input.envPreset));

  const agents = hasExplicitAgents
    ? input.agents
    : hasExplicitPreset
      ? preset?.agents
      : input.envAgents ?? preset?.agents;

  const disabledAgents = input.disabledAgents ??
    input.envDisabledAgents ??
    preset?.disabledAgents;

  return {
    enabledAgents: resolveAgentIds({ agents, disabledAgents }),
    preset,
  };
}
