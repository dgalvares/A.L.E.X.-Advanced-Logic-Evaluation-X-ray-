import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Função utilitária para ler arquivos locais.
 * Em um cenário "Ephemeral RAG", lemos os arquivos em memória.
 */
function readLocalRules(query?: string): string {
  const rulesDir = path.resolve(process.cwd(), '.agents');
  
  if (!fs.existsSync(rulesDir)) {
    return 'Aviso: Diretório de regras (.agents) não encontrado. Assumir que não há regras estritas de domínio adicionais a aplicar.';
  }

  let combinedRules = '';
  const files = fs.readdirSync(rulesDir);

  for (const file of files) {
    if (file.endsWith('.md') || file.endsWith('.txt')) {
      const filePath = path.join(rulesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      combinedRules += `\n=== REGRAS DE [${file}] ===\n${content}\n`;
    }
  }

  // Num RAG vetorial real (Vector Search), aqui faríamos a busca por similaridade do "query" contra os embeddings.
  // Como a base é pequena (Ephemeral), apenas anexamos tudo. O LLM tem janela de contexto suficiente para extrair a resposta.
  return combinedRules || 'Nenhuma regra de negócio encontrada nos arquivos locais.';
}

/**
 * Ferramenta que expõe as regras locais para os agentes de contexto (Business Proxy).
 */
export const searchLocalRules = new FunctionTool({
  name: 'search_local_rules',
  description: 'Busca e lê os arquivos de regras de negócio locais (como .agents/rules.md) para validar restrições arquiteturais.',
  parameters: z.object({
    query: z.string().optional().describe('Palavra-chave ou termo para focar a busca (ex: "segurança", "regras", "tipagem"). Opcional.'),
  }),
  execute: ({ query }) => {
    return readLocalRules(query);
  }
});
