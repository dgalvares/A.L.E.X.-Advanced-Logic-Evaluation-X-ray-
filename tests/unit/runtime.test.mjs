import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPayloadAgentModels,
  resolveAnalysisMode,
  resolveRuntimeModel,
  withResolvedAnalysisMode,
} from '../../dist/runtime.js';

test('resolveAnalysisMode honors explicit metadata mode', () => {
  assert.equal(
    resolveAnalysisMode({
      metadata: { analysisMode: 'FULL_FILE' },
      diff: 'diff --git a/a.ts b/a.ts',
    }),
    'FULL_FILE',
  );
});

test('resolveAnalysisMode infers mode from available content', () => {
  assert.equal(resolveAnalysisMode({ diff: 'diff' }), 'DIFF_ONLY');
  assert.equal(resolveAnalysisMode({ sourceCode: 'const a = 1;' }), 'FULL_FILE');
  assert.equal(resolveAnalysisMode({ diff: 'diff', sourceCode: 'const a = 1;' }), 'DIFF_WITH_CONTEXT');
});

test('withResolvedAnalysisMode returns an immutable request copy with metadata mode', () => {
  const request = {
    diff: 'diff',
    metadata: { project: 'alex' },
  };
  const resolved = withResolvedAnalysisMode(request);

  assert.notEqual(resolved, request);
  assert.equal(request.metadata.analysisMode, undefined);
  assert.equal(resolved.metadata.analysisMode, 'DIFF_ONLY');
  assert.equal(resolved.metadata.project, 'alex');
});

test('resolveRuntimeModel applies explicit > payload > default precedence', () => {
  const originalModel = process.env.ALEX_MODEL;

  try {
    process.env.ALEX_MODEL = 'env-model';

    assert.equal(resolveRuntimeModel(), 'env-model');
    assert.equal(
      resolveRuntimeModel({ request: { metadata: { model: 'payload-model' } } }),
      'payload-model',
    );
    assert.equal(
      resolveRuntimeModel({
        explicitModel: 'cli-model',
        request: { metadata: { model: 'payload-model' } },
      }),
      'cli-model',
    );
  } finally {
    if (originalModel === undefined) {
      delete process.env.ALEX_MODEL;
    } else {
      process.env.ALEX_MODEL = originalModel;
    }
  }
});

test('getPayloadAgentModels converts request metadata to AgentModelMap', () => {
  const map = getPayloadAgentModels({
    metadata: {
      agentModels: {
        'security-auditor': 'security-model',
        'architect-consolidator': 'consolidator-model',
      },
    },
  });

  assert.equal(map?.get('security-auditor'), 'security-model');
  assert.equal(map?.get('architect-consolidator'), 'consolidator-model');
  assert.equal(getPayloadAgentModels({ metadata: {} }), undefined);
});
