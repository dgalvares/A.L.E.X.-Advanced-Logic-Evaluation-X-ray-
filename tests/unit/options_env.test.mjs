import test from 'node:test';
import assert from 'node:assert/strict';
import { isEnabledOption } from '../../dist/utils/options.js';
import { getSanitizedChildEnv } from '../../dist/utils/subprocess_env.js';

test('isEnabledOption accepts explicit true-like values only', () => {
  assert.equal(isEnabledOption(true), true);
  assert.equal(isEnabledOption('true'), true);
  assert.equal(isEnabledOption('1'), true);
  assert.equal(isEnabledOption('yes'), true);
  assert.equal(isEnabledOption('on'), true);
  assert.equal(isEnabledOption('false'), false);
  assert.equal(isEnabledOption('0'), false);
  assert.equal(isEnabledOption(undefined), false);
});

test('getSanitizedChildEnv preserves PATH-like variables and omits arbitrary secrets', () => {
  const originalPath = process.env.PATH;
  const originalSecret = process.env.ALEX_TEST_SECRET;

  try {
    process.env.PATH = 'test-path';
    process.env.ALEX_TEST_SECRET = 'do-not-forward';

    const env = getSanitizedChildEnv();

    assert.equal(env.PATH, 'test-path');
    assert.equal(env.ALEX_TEST_SECRET, undefined);
  } finally {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }

    if (originalSecret === undefined) {
      delete process.env.ALEX_TEST_SECRET;
    } else {
      process.env.ALEX_TEST_SECRET = originalSecret;
    }
  }
});
