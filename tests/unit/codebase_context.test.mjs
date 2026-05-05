import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getCodebaseContext } from '../../dist/tools/codebase_context.js';

function makeTempRepo(t) {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-codebase-context-'));
  t.after(() => {
    fs.rmSync(repoPath, { recursive: true, force: true });
  });
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'ignore' });
  return repoPath;
}

function writeFile(repoPath, filePath, content) {
  const fullPath = path.join(repoPath, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

test('getCodebaseContext includes tracked source files', async (t) => {
  const repoPath = makeTempRepo(t);
  writeFile(repoPath, 'src/app.ts', 'export const value = 1;\n');
  execFileSync('git', ['add', 'src/app.ts'], { cwd: repoPath, stdio: 'ignore' });

  const context = await getCodebaseContext({ cwd: repoPath });

  assert.match(context, /=== File: src\/app\.ts ===/);
  assert.match(context, /export const value = 1;/);
});

test('getCodebaseContext omits sensitive and generated files', async (t) => {
  const repoPath = makeTempRepo(t);
  writeFile(repoPath, 'src/app.ts', 'export const value = 1;\n');
  writeFile(repoPath, '.env', 'SECRET=value\n');
  writeFile(repoPath, 'dist/app.js', 'console.log("generated");\n');
  writeFile(repoPath, 'Cargo.lock', 'huge lockfile\n');
  execFileSync('git', ['add', 'src/app.ts', '.env', 'dist/app.js', 'Cargo.lock'], { cwd: repoPath, stdio: 'ignore' });

  const context = await getCodebaseContext({ cwd: repoPath });

  assert.match(context, /=== File: src\/app\.ts ===/);
  assert.doesNotMatch(context, /SECRET=value/);
  assert.doesNotMatch(context, /console\.log\("generated"\)/);
  assert.doesNotMatch(context, /huge lockfile/);
  assert.match(context, /CODEBASE CONTEXT NOTICE/);
  assert.match(context, /sensitive-path=1/);
  assert.match(context, /generated-or-noisy-path=2/);
});

test('getCodebaseContext redacts source secrets before returning context', async (t) => {
  const repoPath = makeTempRepo(t);
  writeFile(repoPath, 'src/config.ts', 'export const token = "abc123";\n');
  execFileSync('git', ['add', 'src/config.ts'], { cwd: repoPath, stdio: 'ignore' });

  const context = await getCodebaseContext({ cwd: repoPath });

  assert.match(context, /=== File: src\/config\.ts ===/);
  assert.match(context, /ALEX REDACTED/);
  assert.doesNotMatch(context, /abc123/);
});

test('getCodebaseContext respects total context limits', async (t) => {
  const repoPath = makeTempRepo(t);
  writeFile(repoPath, 'a.ts', 'a'.repeat(128));
  writeFile(repoPath, 'b.ts', 'b'.repeat(128));
  execFileSync('git', ['add', 'a.ts', 'b.ts'], { cwd: repoPath, stdio: 'ignore' });

  const context = await getCodebaseContext({
    cwd: repoPath,
    maxTotalBytes: 180,
  });

  assert.match(context, /=== File: a\.ts ===/);
  assert.doesNotMatch(context, /=== File: b\.ts ===/);
  assert.match(context, /Codebase context limit reached/);
  assert.match(context, /total-context-limit=1/);
});

test('getCodebaseContext can disable size and count limits explicitly', async (t) => {
  const repoPath = makeTempRepo(t);
  writeFile(repoPath, 'a.ts', 'a'.repeat(128));
  writeFile(repoPath, 'b.ts', 'b'.repeat(128));
  execFileSync('git', ['add', 'a.ts', 'b.ts'], { cwd: repoPath, stdio: 'ignore' });

  const context = await getCodebaseContext({
    cwd: repoPath,
    maxTotalBytes: 180,
    maxFiles: 1,
    maxGitListBytes: 1,
    disableLimits: true,
  });

  assert.match(context, /=== File: a\.ts ===/);
  assert.match(context, /=== File: b\.ts ===/);
  assert.doesNotMatch(context, /Codebase context limit reached/);
});

test('getCodebaseContext respects individual file and binary filters', async (t) => {
  const repoPath = makeTempRepo(t);
  writeFile(repoPath, 'small.ts', 'export const small = true;\n');
  writeFile(repoPath, 'large.ts', 'x'.repeat(256));
  fs.writeFileSync(path.join(repoPath, 'binary.dat'), Buffer.from([0, 1, 2, 3]));
  execFileSync('git', ['add', 'small.ts', 'large.ts', 'binary.dat'], { cwd: repoPath, stdio: 'ignore' });

  const context = await getCodebaseContext({
    cwd: repoPath,
    maxFileBytes: 128,
  });

  assert.match(context, /=== File: small\.ts ===/);
  assert.doesNotMatch(context, /=== File: large\.ts ===/);
  assert.doesNotMatch(context, /=== File: binary\.dat ===/);
  assert.match(context, /file-size-limit=1/);
  assert.match(context, /binary-file=1/);
});

test('getCodebaseContext rejects oversized git tracked file output', async (t) => {
  const repoPath = makeTempRepo(t);
  writeFile(repoPath, 'src/app.ts', 'export const value = 1;\n');
  execFileSync('git', ['add', 'src/app.ts'], { cwd: repoPath, stdio: 'ignore' });

  await assert.rejects(
    () => getCodebaseContext({ cwd: repoPath, maxGitListBytes: 1 }),
    /Lista de arquivos rastreados excede/,
  );
});

test('getCodebaseContext excludes files already supplied by diff context', async (t) => {
  const repoPath = makeTempRepo(t);
  writeFile(repoPath, 'changed.ts', 'export const changed = true;\n');
  writeFile(repoPath, 'support.ts', 'export const support = true;\n');
  execFileSync('git', ['add', 'changed.ts', 'support.ts'], { cwd: repoPath, stdio: 'ignore' });

  const context = await getCodebaseContext({
    cwd: repoPath,
    excludeFiles: ['changed.ts'],
  });

  assert.doesNotMatch(context, /=== File: changed\.ts ===/);
  assert.match(context, /=== File: support\.ts ===/);
  assert.match(context, /already-in-diff-context=1/);
});

test('getCodebaseContext uses repository-root paths when invoked from a subdirectory', async (t) => {
  const repoPath = makeTempRepo(t);
  writeFile(repoPath, 'src/app.ts', 'export const app = true;\n');
  writeFile(repoPath, 'src/support.ts', 'export const support = true;\n');
  execFileSync('git', ['add', 'src/app.ts', 'src/support.ts'], { cwd: repoPath, stdio: 'ignore' });

  const context = await getCodebaseContext({
    cwd: path.join(repoPath, 'src'),
    excludeFiles: ['src/app.ts'],
  });

  assert.doesNotMatch(context, /=== File: src\/app\.ts ===/);
  assert.match(context, /=== File: src\/support\.ts ===/);
  assert.match(context, /already-in-diff-context=1/);
});

test('getCodebaseContext tolerates tracked files removed before reading', async (t) => {
  const repoPath = makeTempRepo(t);
  writeFile(repoPath, 'present.ts', 'export const present = true;\n');
  writeFile(repoPath, 'missing.ts', 'export const missing = true;\n');
  execFileSync('git', ['add', 'present.ts', 'missing.ts'], { cwd: repoPath, stdio: 'ignore' });
  fs.unlinkSync(path.join(repoPath, 'missing.ts'));

  const context = await getCodebaseContext({ cwd: repoPath });

  assert.match(context, /=== File: present\.ts ===/);
  assert.doesNotMatch(context, /missing = true/);
  assert.match(context, /path-resolution-failed=1/);
});

test('getCodebaseContext omits symlinks that resolve outside the workspace', async (t) => {
  const repoPath = makeTempRepo(t);
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-codebase-outside-'));
  t.after(() => {
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  writeFile(repoPath, 'src/app.ts', 'export const value = 1;\n');
  const outsideFile = path.join(outsideDir, 'secret.ts');
  fs.writeFileSync(outsideFile, 'export const secret = true;\n');

  try {
    fs.symlinkSync(outsideFile, path.join(repoPath, 'outside-link.ts'));
  } catch {
    t.skip('symlink creation is not available in this environment');
    return;
  }

  execFileSync('git', ['add', 'src/app.ts', 'outside-link.ts'], { cwd: repoPath, stdio: 'ignore' });

  const context = await getCodebaseContext({ cwd: repoPath });

  assert.match(context, /=== File: src\/app\.ts ===/);
  assert.doesNotMatch(context, /secret = true/);
  assert.match(context, /outside-workspace=1/);
});
