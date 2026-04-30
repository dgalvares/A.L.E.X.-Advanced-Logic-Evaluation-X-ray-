# Backlog: Review Presets por Proposito

Este backlog formaliza a camada de presets do A.L.E.X: setups nomeados que combinam agentes e modelos recomendados de acordo com o objetivo da analise.

## Objetivo

Reduzir atrito na escolha de agentes sem remover o controle avancado ja existente.

Hoje o A.L.E.X ja permite:

- selecionar agentes por `--agents`;
- remover agentes por `--disable-agents`;
- definir modelo global por `--model` / `ALEX_MODEL`;
- definir modelo por agente por `--agent-models` / `ALEX_MODEL_<AGENT>`;
- persistir agentes e modelo via `alex config`.

Os presets devem ser uma camada semantica acima dessas opcoes, transformando um proposito de review em uma configuracao pronta.

Exemplos desejados:

```bash
alex review --preset fast
alex review --preset security
alex review --preset release
alex ci --diff-file pr.diff --preset ops
alex config set-preset default
```

## Decisao de Design

Implementar presets como catalogo local deterministico, sem chamada LLM adicional.

Motivos:

- zero custo extra de API;
- comportamento previsivel em CI/CD;
- facil de testar;
- preserva compatibilidade com `--agents`, `--disable-agents` e `--agent-models`.

O preset nao deve substituir o catalogo de agentes. Ele apenas resolve para:

```ts
{
  id: string;
  description: string;
  agents: string;
  disabledAgents?: string;
  model?: string;
  agentModels?: Record<string, string>;
}
```

## Presets Propostos

### `default`

Review equilibrado atual, mantendo compatibilidade com o comportamento existente.

```text
agents:
  security-auditor
  clean-coder
  sre-agent
  business-proxy
```

Uso recomendado:

- review padrao local;
- CI/CD generico;
- mudancas comuns de produto.

### `fast`

Review rapido e mais barato para mudancas pequenas.

```text
agents:
  clean-coder
  security-auditor
```

Uso recomendado:

- ajustes pequenos;
- refactors locais;
- feedback rapido antes de uma analise mais ampla.

### `security`

Auditoria focada em risco, segredos, autenticacao, autorizacao, fail-open e vazamento de dados.

```text
agents:
  security-auditor
  error-handling-specialist
  sre-agent
  clean-coder
```

Uso recomendado:

- mudancas em auth;
- manipulacao de segredos;
- endpoints publicos;
- validacao de input;
- mudancas em autorizacao, upload, path handling ou criptografia.

### `quality`

Review focado em manutenibilidade, contratos, design e testes.

```text
agents:
  clean-coder
  test-strategist
  error-handling-specialist
```

Uso recomendado:

- refactors;
- alteracoes em contratos internos;
- mudancas em testes;
- revisao de qualidade antes de merge.

### `ops`

Review focado em producao, resiliencia, escala e observabilidade.

```text
agents:
  sre-agent
  observability-engineer
  scalability-architect
  error-handling-specialist
  security-auditor
```

Uso recomendado:

- infra;
- jobs;
- filas;
- cache;
- rate limiting;
- logging, metricas e tracing;
- mudancas com impacto operacional.

### `docs`

Review focado em documentacao, exemplos, README, changelog e coerencia com regras de negocio.

```text
agents:
  docs-maintainer
  business-proxy
```

Uso recomendado:

- README;
- documentacao de API;
- guias de uso;
- changelog;
- runbooks;
- exemplos para consumidores.

### `release`

Review amplo para pre-merge ou pre-release.

```text
agents:
  all
```

Uso recomendado:

- PRs grandes;
- release candidates;
- merge para `main`;
- mudancas de arquitetura;
- revisao manual acionada em CI.

## Presets Fora do MVP

Estes podem entrar depois se houver uso real:

### `tests`

```text
agents:
  test-strategist
  clean-coder
  error-handling-specialist
```

### `architecture`

```text
agents:
  clean-coder
  sre-agent
  scalability-architect
  business-proxy
  security-auditor
```

## Aliases

Aliases opcionais para UX:

```text
quick -> fast
prod -> ops
full -> release
all -> release
```

Aliases devem aparecer em `alex config show` e em mensagens de erro como aliases, nao como presets canonicos.

## Modelos

No MVP, presets devem definir principalmente agentes.

Recomendacao:

- `default`, `security`, `quality`, `ops` e `release` usam o modelo global ativo (`--model`, `ALEX_MODEL` ou config).
- `fast` e `docs` podem se beneficiar de modelo mais barato/rapido, mas isso nao deve ser hardcoded no primeiro corte.
- `agentModels` por preset deve ficar preparado no tipo, mas sem uso obrigatorio ate haver metricas de custo/qualidade.

Exemplo futuro:

```ts
{
  id: 'security',
  agents: 'security-auditor,error-handling-specialist,sre-agent,clean-coder',
  agentModels: {
    'security-auditor': 'gemini-2.5-pro',
    'architect-consolidator': 'gemini-2.5-pro'
  }
}
```

## Precedencia

Presets devem respeitar a configuracao explicita do usuario.

Precedencia proposta:

```text
CLI flags explicitas
> --preset
> env vars / config persistente
> default atual
```

Detalhamento:

- `--agents` sobrescreve agentes definidos pelo preset.
- `--disable-agents` sempre remove agentes do conjunto final.
- `--agent-models` sobrescreve qualquer `agentModels` vindo do preset.
- `--model` sobrescreve modelo global vindo do preset.
- `ALEX_PRESET` deve ter menor prioridade que `--preset`.
- `alex config set-preset` deve ter menor prioridade que `ALEX_PRESET`.

## Implementacao

### Fase 1: Catalogo e Resolver

Criar `src/agents/presets.ts` ou `src/profiles/presets.ts`.

Responsabilidades:

- declarar `PRESET_CATALOG`;
- declarar aliases;
- validar preset desconhecido;
- resolver preset canonico;
- converter preset para entrada aceita por `resolveAgentIds` e `resolveAgentModels`.

Critérios de aceite:

- `fast`, `default`, `security`, `quality`, `ops`, `docs` e `release` existem;
- aliases resolvem para o preset canonico correto;
- erro de preset desconhecido lista presets validos.

### Fase 2: CLI e Config Persistente

Adicionar:

```bash
alex review --preset security
alex analyze src/file.ts --preset quality
alex ci --diff-file pr.diff --preset release
alex config set-preset security
alex config clear-preset
alex config show
```

Atualizar `~/.alex/config.json`:

```json
{
  "preset": "security"
}
```

Critérios de aceite:

- ausencia de preset mantem comportamento atual;
- `--agents` continua funcionando como override explicito;
- `alex config show` mostra preset ativo e fonte (`cli`, `env`, `user-config` ou `none`).

### Fase 3: API

Adicionar ao contrato:

```ts
metadata: {
  preset?: string;
}
```

Critérios de aceite:

- API aceita `metadata.preset`;
- `metadata.agents` sobrescreve agentes do preset;
- `metadata.disabledAgents` remove agentes do conjunto final;
- preset invalido retorna HTTP 400 com mensagem clara.

### Fase 4: GitHub Actions

Adicionar suporte a:

```text
ALEX_PRESET=security
```

Permitir comentarios:

```text
alex review --preset security
alex review security
alex review release
```

Critérios de aceite:

- workflow consumidor aceita `vars.ALEX_PRESET`;
- comentario com preset conhecido configura a execucao;
- comentario com token desconhecido continua gerando warning, nao execucao ambigua.

### Fase 5: Documentacao e Testes

Atualizar README com:

- tabela de presets;
- exemplos CLI;
- exemplo API;
- exemplo GitHub Actions;
- explicacao de precedencia.

Testes unitarios:

- resolver de presets;
- aliases;
- precedencia `--agents` > `--preset` > env/config;
- preset `release` expande para `all`;
- preset desconhecido falha com mensagem clara;
- API aceita `metadata.preset`;
- workflows passam `ALEX_PRESET`.

## Riscos

- Muitos presets podem confundir o usuario.
- Presets podem esconder agentes importantes se forem mal nomeados.
- `release` aumenta custo e latencia por usar todos os agentes.
- Modelo por preset pode gerar comportamento inesperado se sobrescrever config do usuario.

## Fora de Escopo Inicial

- Multi-provider por preset.
- Fallback automatico entre modelos.
- Presets aprendidos historicamente.
- Triagem automatica por arquivo ou conteudo.
- UI web para montar presets customizados.

## Plano de Entrega Recomendado

### PR 1: MVP de Presets

- catalogo;
- resolver;
- CLI `--preset`;
- config persistente;
- testes unitarios;
- README.

### PR 2: API e GitHub Actions

- `metadata.preset`;
- `ALEX_PRESET`;
- parsing de comentarios;
- testes de workflow.

### PR 3: Modelos por Preset

- preparar `agentModels` por preset;
- adicionar rastreabilidade no usage/report;
- ajustar docs com recomendacoes de custo.
