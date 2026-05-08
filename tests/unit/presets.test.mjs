import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getReviewPreset,
  isReviewPresetName,
  resolvePresetId,
  listPresetNames,
} from '../../dist/agents/presets.js';
import {
  ALL_AGENT_IDS,
} from '../../dist/agents/catalog.js';
import {
  resolveAgentIds,
} from '../../dist/agents/agent_parser.js';
import {
  resolveAgentProfile,
  resolveReviewProfileShortcut,
} from '../../dist/agents/profile_resolver.js';

test('getReviewPreset resolves named presets to agent profiles', () => {
  const preset = getReviewPreset('security');

  assert.equal(preset?.id, 'security');
  assert.deepEqual(resolveAgentIds({ agents: preset?.agents }), [
    'security-auditor',
    'error-handling-specialist',
    'sre-agent',
    'clean-coder',
  ]);
});

test('preset aliases resolve to canonical preset ids', () => {
  assert.equal(resolvePresetId('quick'), 'fast');
  assert.equal(resolvePresetId('prod'), 'ops');
  assert.equal(resolvePresetId('full'), 'release');
});

test('release preset expands to every configurable analysis agent', () => {
  const preset = getReviewPreset('release');

  assert.deepEqual(resolveAgentIds({ agents: preset?.agents }), [...ALL_AGENT_IDS]);
});

test('unknown preset error lists valid presets and aliases', () => {
  assert.throws(
    () => getReviewPreset('mystery'),
    /Presets validos: .*security.*quick/,
  );
  assert.equal(listPresetNames().includes('release'), true);
});

test('preset lookup does not accept inherited Object prototype properties', () => {
  assert.equal(isReviewPresetName('constructor'), false);
  assert.throws(() => resolvePresetId('constructor'), /Preset desconhecido/);
  assert.equal(resolvePresetId('quick'), 'fast');
});

test('agent profile precedence keeps explicit agents above presets', () => {
  const resolved = resolveAgentProfile({
    agents: 'security-auditor',
    preset: 'release',
    envAgents: 'all',
    envPreset: 'ops',
  });

  assert.deepEqual(resolved.enabledAgents, ['security-auditor']);
  assert.equal(resolved.preset, undefined);
});

test('agent profile precedence lets explicit preset override env agents', () => {
  const resolved = resolveAgentProfile({
    preset: 'fast',
    envAgents: 'all',
  });

  assert.deepEqual(resolved.enabledAgents, ['clean-coder', 'security-auditor']);
  assert.equal(resolved.preset?.id, 'fast');
});

test('agent profile precedence lets env agents override env preset', () => {
  const resolved = resolveAgentProfile({
    envAgents: 'security-auditor',
    envPreset: 'release',
  });

  assert.deepEqual(resolved.enabledAgents, ['security-auditor']);
  assert.equal(resolved.preset, undefined);
});

test('agent profile uses env preset when env agents are absent', () => {
  const resolved = resolveAgentProfile({
    envPreset: 'docs',
  });

  assert.deepEqual(resolved.enabledAgents, ['docs-maintainer', 'business-proxy']);
  assert.equal(resolved.preset?.id, 'docs');
});

test('review positional shortcut treats known presets as presets', () => {
  assert.deepEqual(resolveReviewProfileShortcut('release'), {
    agents: undefined,
    preset: 'release',
  });
  assert.deepEqual(resolveReviewProfileShortcut('security-auditor'), {
    agents: 'security-auditor',
    preset: undefined,
  });
});

test('review positional shortcut does not override explicit options', () => {
  assert.deepEqual(resolveReviewProfileShortcut('release', { agents: 'clean-coder' }), {
    agents: 'clean-coder',
    preset: undefined,
  });
  assert.deepEqual(resolveReviewProfileShortcut('security-auditor', { preset: 'fast' }), {
    agents: undefined,
    preset: 'fast',
  });
});
