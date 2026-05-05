import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { isBlockedSensitivePath } from '../utils/sensitive_paths.js';
import { isLikelyBinary, isWithinDirectory } from '../utils/file_guards.js';
import { getSanitizedChildEnv } from '../utils/subprocess_env.js';
import { sanitizeSourceContent } from '../utils/diff_sanitizer.js';

const MAX_GIT_LIST_BYTES = 4 * 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
const GIT_LIST_TIMEOUT_MS = 30_000;
const READ_BATCH_SIZE = 8;

export const MAX_CODEBASE_CONTEXT_FILE_BYTES = 512 * 1024;
export const MAX_CODEBASE_CONTEXT_TOTAL_BYTES = 8 * 1024 * 1024;
export const MAX_CODEBASE_CONTEXT_FILES = 500;

const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '.parcel-cache',
  'bin',
  'obj',
]);

const SKIPPED_BASENAMES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
  'poetry.lock',
  'cargo.lock',
]);

export interface CodebaseContextOptions {
  cwd?: string;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  maxFiles?: number;
  maxGitListBytes?: number;
  disableLimits?: boolean;
  excludeFiles?: Iterable<string>;
}

type CodebaseFileResult =
  | { type: 'section'; section: string; bytes: number }
  | { type: 'omitted'; reason: string };

function shouldSkipTrackedPath(filePath: string): boolean {
  const normalized = normalizeGitPath(filePath);
  const parts = normalized.split('/');
  const baseName = parts[parts.length - 1]?.toLowerCase() || '';

  return parts.some((part) => SKIPPED_DIRECTORIES.has(part)) ||
    SKIPPED_BASENAMES.has(baseName);
}

export async function getGitTopLevel(cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      env: getSanitizedChildEnv(),
    });
    const chunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let totalStderrBytes = 0;
    let settled = false;
    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      finish(() => reject(new Error(`git rev-parse excedeu o timeout de ${GIT_LIST_TIMEOUT_MS / 1000}s.`)));
    }, GIT_LIST_TIMEOUT_MS);

    const finish = (fn: () => void) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        fn();
      }
    };

    proc.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      totalStderrBytes += chunk.length;
      if (totalStderrBytes <= MAX_STDERR_BYTES) {
        stderrChunks.push(chunk);
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        finish(() => reject(new Error(Buffer.concat(stderrChunks).toString('utf-8') || `git rev-parse saiu com codigo ${code}`)));
        return;
      }

      finish(() => resolve(Buffer.concat(chunks).toString('utf-8').trim()));
    });
    proc.on('error', (err) => finish(() => reject(err)));
  });
}

async function listGitTrackedFiles(cwd: string, maxGitListBytes?: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', ['ls-files', '-z'], {
      cwd,
      env: getSanitizedChildEnv(),
    });
    const chunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let totalBytes = 0;
    let totalStderrBytes = 0;
    let settled = false;
    let pendingError: Error | undefined;
    const timeout = setTimeout(() => {
      pendingError = new Error(`git ls-files excedeu o timeout de ${GIT_LIST_TIMEOUT_MS / 1000}s.`);
      proc.kill('SIGKILL');
    }, GIT_LIST_TIMEOUT_MS);

    const finish = (fn: () => void) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        fn();
      }
    };

    proc.stdout.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (maxGitListBytes !== undefined && totalBytes > maxGitListBytes) {
        pendingError = new Error('Lista de arquivos rastreados excede o limite permitido.');
        proc.kill('SIGKILL');
        return;
      }
      chunks.push(chunk);
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      totalStderrBytes += chunk.length;
      if (totalStderrBytes <= MAX_STDERR_BYTES) {
        stderrChunks.push(chunk);
      }
    });

    proc.on('close', (code) => {
      if (pendingError) {
        finish(() => reject(pendingError));
        return;
      }

      if (code !== 0) {
        finish(() => reject(new Error(Buffer.concat(stderrChunks).toString('utf-8') || `git ls-files saiu com codigo ${code}`)));
        return;
      }

      const files = Buffer.concat(chunks).toString('utf-8').split('\0').filter(Boolean);
      finish(() => resolve(files));
    });
    proc.on('error', (err) => finish(() => reject(err)));
  });
}

function normalizeGitPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function incrementReason(reasons: Record<string, number>, reason: string, amount = 1): void {
  reasons[reason] = (reasons[reason] ?? 0) + amount;
}

async function readCodebaseFile(
  cwd: string,
  cwdReal: string,
  file: string,
  maxFileBytes: number,
): Promise<CodebaseFileResult> {
  if (shouldSkipTrackedPath(file)) {
    return { type: 'omitted', reason: 'generated-or-noisy-path' };
  }

  const targetPath = path.resolve(cwd, file);
  let resolvedPath: string;
  try {
    resolvedPath = await fs.promises.realpath(targetPath);
  } catch {
    return { type: 'omitted', reason: 'path-resolution-failed' };
  }

  if (!isWithinDirectory(cwdReal, resolvedPath)) {
    return { type: 'omitted', reason: 'outside-workspace' };
  }

  if (isBlockedSensitivePath(resolvedPath)) {
    return { type: 'omitted', reason: 'sensitive-path' };
  }

  let buffer: Buffer;
  try {
    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isFile()) {
      return { type: 'omitted', reason: 'not-a-file' };
    }

    if (stat.size > maxFileBytes) {
      return { type: 'omitted', reason: 'file-size-limit' };
    }

    buffer = await fs.promises.readFile(resolvedPath);
  } catch {
    return { type: 'omitted', reason: 'file-read-failed' };
  }

  if (isLikelyBinary(buffer)) {
    return { type: 'omitted', reason: 'binary-file' };
  }

  const content = sanitizeSourceContent(buffer.toString('utf-8'));
  const section = `=== File: ${file} ===\n${content}\n`;
  return {
    type: 'section',
    section,
    bytes: Buffer.byteLength(section, 'utf-8'),
  };
}

export async function getCodebaseContext(options: CodebaseContextOptions = {}): Promise<string | undefined> {
  const requestedCwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const cwd = await getGitTopLevel(requestedCwd);
  const cwdReal = await fs.promises.realpath(cwd);
  const disableLimits = options.disableLimits === true;
  const maxFileBytes = disableLimits ? Number.POSITIVE_INFINITY : (options.maxFileBytes ?? MAX_CODEBASE_CONTEXT_FILE_BYTES);
  const maxTotalBytes = disableLimits ? Number.POSITIVE_INFINITY : (options.maxTotalBytes ?? MAX_CODEBASE_CONTEXT_TOTAL_BYTES);
  const maxFiles = disableLimits ? Number.POSITIVE_INFINITY : (options.maxFiles ?? MAX_CODEBASE_CONTEXT_FILES);
  const excludedFiles = new Set(Array.from(options.excludeFiles ?? []).map(normalizeGitPath));
  const trackedFiles = await listGitTrackedFiles(cwd, disableLimits ? undefined : (options.maxGitListBytes ?? MAX_GIT_LIST_BYTES));
  const sections: string[] = [];
  const omissionReasons: Record<string, number> = {};
  let totalBytes = 0;
  let inspectedFiles = 0;
  let omittedFiles = 0;
  let limitReached = false;

  for (let index = 0; index < trackedFiles.length && !limitReached; index += READ_BATCH_SIZE) {
    const batch = trackedFiles.slice(index, index + READ_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(async (file): Promise<CodebaseFileResult> => {
      const normalizedFile = normalizeGitPath(file);
      if (excludedFiles.has(normalizedFile)) {
        return { type: 'omitted', reason: 'already-in-diff-context' };
      }

      return readCodebaseFile(cwd, cwdReal, file, maxFileBytes);
    }));

    for (let resultIndex = 0; resultIndex < batchResults.length; resultIndex += 1) {
      const result = batchResults[resultIndex];

      if (result.type === 'omitted') {
        omittedFiles += 1;
        incrementReason(omissionReasons, result.reason);
        continue;
      }

      if (inspectedFiles >= maxFiles) {
        limitReached = true;
        const remainingFiles = trackedFiles.length - (index + resultIndex);
        omittedFiles += remainingFiles;
        incrementReason(omissionReasons, 'file-count-limit', remainingFiles);
        break;
      }

      if (totalBytes + result.bytes > maxTotalBytes) {
        limitReached = true;
        const remainingFiles = trackedFiles.length - (index + resultIndex);
        omittedFiles += remainingFiles;
        incrementReason(omissionReasons, 'total-context-limit', remainingFiles);
        break;
      }

      sections.push(result.section);
      totalBytes += result.bytes;
      inspectedFiles += 1;
    }
  }

  if (sections.length === 0) return undefined;

  let combinedContext = sections.join('');
  if (limitReached || omittedFiles > 0) {
    combinedContext += [
      '\n=== CODEBASE CONTEXT NOTICE ===',
      `Included ${inspectedFiles} tracked files from the codebase.`,
      `Omitted ${omittedFiles} files due to safety, size, binary, generated-file, or total-context limits.`,
      `Omission reasons: ${Object.entries(omissionReasons).map(([reason, count]) => `${reason}=${count}`).join(', ') || 'none'}.`,
      limitReached ? 'Codebase context limit reached; remaining files were omitted.' : '',
      '',
    ].filter(Boolean).join('\n');
  }

  if (limitReached) {
    console.warn(`[ALEX] Codebase context truncated: included ${inspectedFiles} files, omitted ${omittedFiles}.`);
  }

  if (disableLimits) {
    console.warn(`[ALEX] Codebase context size limits disabled by user request: included ${inspectedFiles} files (${totalBytes} bytes before prompt overhead).`);
  }

  return combinedContext;
}
