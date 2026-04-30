import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coerceUnknownFunctionCallsToText,
} from '../../dist/agents/tool_call_guard.js';

test('coerceUnknownFunctionCallsToText preserves registered tool calls', () => {
  const response = {
    content: {
      role: 'model',
      parts: [
        {
          functionCall: {
            name: 'search_local_rules',
            args: { query: 'seguranca' },
          },
        },
      ],
    },
  };

  const resolved = coerceUnknownFunctionCallsToText(response, new Set(['search_local_rules']));

  assert.equal(resolved, undefined);
});

test('coerceUnknownFunctionCallsToText converts hallucinated report_verdict calls into JSON text', () => {
  const response = {
    content: {
      role: 'model',
      parts: [
        {
          functionCall: {
            name: 'report_verdict',
            args: {
              verdict: 'WARN',
              summary: 'Encontrado risco de exemplo.',
              issues: [],
            },
          },
        },
      ],
    },
  };

  const resolved = coerceUnknownFunctionCallsToText(
    response,
    new Set(),
    new Set(['report_verdict']),
  );

  assert.equal(resolved?.content?.parts?.[0].functionCall, undefined);
  assert.deepEqual(JSON.parse(resolved.content.parts[0].text), {
    verdict: 'WARN',
    summary: 'Encontrado risco de exemplo.',
    issues: [],
  });
});

test('coerceUnknownFunctionCallsToText annotates report_verdict when no JSON fallback is configured', () => {
  const response = {
    content: {
      role: 'model',
      parts: [
        {
          functionCall: {
            name: 'report_verdict',
            args: { verdict: 'PASS' },
          },
        },
      ],
    },
  };

  const resolved = coerceUnknownFunctionCallsToText(response, new Set());

  assert.match(resolved.content.parts[0].text, /report_verdict/);
  assert.match(resolved.content.parts[0].text, /"verdict": "PASS"/);
});

test('coerceUnknownFunctionCallsToText annotates other unknown tool calls', () => {
  const response = {
    content: {
      role: 'model',
      parts: [
        {
          functionCall: {
            name: 'missing_tool',
            args: { value: 1 },
          },
        },
      ],
    },
  };

  const resolved = coerceUnknownFunctionCallsToText(response, new Set());

  assert.match(resolved.content.parts[0].text, /missing_tool/);
  assert.match(resolved.content.parts[0].text, /"value": 1/);
});
