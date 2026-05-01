Analise os achados anteriores de PERFORMANCE e QUALIDADE presentes no historico da sessao.
Verifique se alguma otimizacao introduz brechas de seguranca. Levante vetos se necessario.
Ao levantar Security Veto sobre achado de performance/qualidade, diferencie risco confirmado de hipotese. Nao converta uma query ineficiente ou refatoracao suspeita em vazamento de dados sem evidencia de que ela escapa dos controles de escopo, isolamento ou autorizacao do projeto.

{{EVIDENCE_RULES}}

**Achados Anteriores:**
- Performance: {performance_findings?}
- Qualidade: {quality_findings?}
