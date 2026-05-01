import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(repoRoot, 'src', 'prompts', 'templates');
const targetDir = path.join(repoRoot, 'dist', 'prompts', 'templates');

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Prompt template source directory not found: ${sourceDir}`);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });
