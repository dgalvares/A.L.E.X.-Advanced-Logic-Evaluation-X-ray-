Escopo de achados:
- Modo DIFF_WITH_CONTEXT: consolide apenas achados cuja causa esteja em linhas adicionadas, removidas ou modificadas pelo diff.
- Use sourceCode apenas como contexto para validar ou descartar suspeitas do diff.
- Descarte achados que dependam exclusivamente de codigo inalterado fora dos hunks do diff.
- Se o problema existir apenas no contexto completo e nao for causado por uma linha alterada, nao o inclua no relatorio final.
