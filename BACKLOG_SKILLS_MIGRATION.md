# Backlog: Migração para Arquitetura de Skills (ADK)

Este backlog detalha a transição do sistema de agentes especializados baseados em prompts fixos para um modelo modular baseado em **Skills** do Agent Development Kit (ADK).

## Visão Geral
A arquitetura atual do ALEX utiliza agentes estáticos. A migração para Skills permitirá:
1.  **Carregamento dinâmico** de capacidades.
2.  **Redução do context window** (carregando instruções apenas quando necessário).
3.  **Melhor reuso** de lógica entre agentes de conselho e reflexão.

---

## Roadmap de Implementação

### Fase 1: Infraestrutura de Skills
- [ ] **SKILL-01:** Criar diretório base `src/skills` e definir o `SkillLoader`.
- [ ] **SKILL-02:** Adaptar o `ReviewOrchestrator` para suportar `SkillToolset` nas instâncias de `LlmAgent`.
- [ ] **SKILL-03:** Implementar suporte a L3 (Assets/References) para que os agentes possam consultar arquivos de regras locais via Skills nativas.

### Fase 2: Migração de Especialistas (Agentes de Conselho)
- [ ] **SKILL-04:** Converter `BusinessProxy` para `BusinessContextSkill`.
    - Mover prompt de `src/prompts/templates/business-proxy.md` para `src/skills/business-context/SKILL.md`.
    - Vincular a ferramenta `search_local_rules` diretamente à Skill.
- [ ] **SKILL-05:** Converter `SecurityAuditor` para `SecurityAuditSkill`.
- [ ] **SKILL-06:** Converter `CleanCoder` para `CodeQualitySkill`.
- [ ] **SKILL-07:** Converter `SreAgent` para `PerformanceOptimizationSkill`.

### Fase 3: Migração de Reviewers (Agentes de Reflexão)
- [ ] **SKILL-08:** Converter `SecurityReviewer` para `SecurityReflectionSkill`.
- [ ] **SKILL-09:** Converter `PerformanceReviewer` para `PerformanceReflectionSkill`.

### Fase 4: Otimização e Extensibilidade
- [ ] **SKILL-10:** Implementar carregamento de Skills externas via CLI (ex: `--skill path/to/my-skill`).
- [ ] **SKILL-11:** Refatorar `AgentDefinition` no `catalog.ts` para ser um `SkillBundle`.

---

## Esboço Técnico: BusinessProxy como Skill

Atualmente, o `BusinessProxy` é definido no código. No novo modelo, ele seria uma estrutura de diretório compatível com a especificação de Skills do ADK.

### Estrutura Sugerida:
```text
src/skills/business-context/
├── SKILL.md          # Metadados (L1) + Instruções Principais (L2)
├── references/       # Regras de negócio detalhadas (L3)
│   └── architecture-guidelines.md
└── tools/            # (Opcional) Registro de ferramentas específicas
```

### Exemplo de `SKILL.md`:
```markdown
---
name: business-context
description: Especialista em alinhar o código às regras de negócio e arquitetura local.
tools: [search_local_rules]
---

# Instruções
Você deve validar se as alterações de código respeitam as regras de negócio do projeto.
Use a ferramenta `search_local_rules` para buscar contexto no diretório `.agents/rules` sempre que houver ambiguidade.
...
```

### Alteração no `specialists.ts`:
```typescript
// Como seria a nova factory
export const getBusinessProxy = async (model: string) => {
  const businessSkill = await loadSkillFromDir('src/skills/business-context');
  const skillToolset = new SkillToolset([businessSkill], {
    additionalTools: [searchLocalRules]
  });

  return new LlmAgent({
    name: 'business-proxy',
    model: model,
    tools: [skillToolset],
    // A instrução agora vem da Skill, o Agent pode ter apenas um "wrap" de persona
    instruction: 'Você é o Business Proxy. Use suas skills para validar o contexto.',
    outputKey: 'business_findings',
  });
};
```
