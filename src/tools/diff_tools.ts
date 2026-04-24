import { FunctionTool } from '@google/adk';
import { z } from 'zod';

/**
 * Ferramenta para extrair metadados técnicos do diff.
 */
export const analyzeDiffMetadata = new FunctionTool({
  name: 'analyze_diff_metadata',
  description: 'Analisa um diff de código para identificar extensões de arquivos e a stack tecnológica predominante.',
  parameters: z.object({
    diff: z.string().describe('O conteúdo do diff do Git.'),
  }),
  execute: ({ diff }) => {
    const files = diff.match(/^\+\+\+ b\/(.+)$/gm)?.map(f => f.replace('+++ b/', '')) || [];
    const extensions = new Set(files.map(f => f.split('.').pop()));
    
    let stack = 'unknown';
    if (extensions.has('cs')) stack = '.NET';
    if (extensions.has('ts') || extensions.has('tsx')) stack = 'TypeScript/React';
    if (extensions.has('py')) stack = 'Python';
    if (extensions.has('java')) stack = 'Java';

    return {
      status: 'success',
      report: {
        filesCount: files.length,
        files,
        extensions: Array.from(extensions),
        detectedStack: stack
      }
    };
  },
});
