import { FinalReport, Severity } from '../schemas/contracts.js';

export function formatReportMarkdown(report: FinalReport, title = 'A.L.E.X Code Review'): string {
  const severitySummary = formatSeveritySummary(report);
  const issues = report.issues.length === 0
    ? '> Nenhum apontamento encontrado.'
    : report.issues.map(formatIssue).join('\n\n');

  return [
    `## ${title}`,
    '',
    `${verdictBadge(report.verdict)} ${severitySummary ? severitySummary : ''}`.trim(),
    '',
    `**Apontamentos:** ${report.issues.length}`,
    '',
    '### Resumo',
    '',
    report.summary,
    '',
    '### Apontamentos',
    '',
    issues,
    '',
    '---',
    `<sub>Gerado pelo A.L.E.X em ${report.timestamp}</sub>`,
  ].join('\n');
}

function formatIssue(issue: FinalReport['issues'][number]): string {
  const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
  const snippet = issue.codeSnippet
    ? `\n\n\`\`\`\n${issue.codeSnippet.trim()}\n\`\`\``
    : '';

  return [
    `- ${severityBadge(issue.severity)} **${issue.severity}** em \`${location}\``,
    `  - **Origem:** ${issue.origin}`,
    `  - **Mensagem:** ${issue.message}${snippet}`,
  ].join('\n');
}

function formatSeveritySummary(report: FinalReport): string {
  const counts = report.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {});

  const parts = (['Blocker', 'Critical', 'Major', 'Minor', 'Info'] as Severity[])
    .filter((severity) => counts[severity])
    .map((severity) => `${severityBadge(severity)} ${counts[severity]}`);

  return parts.length > 0 ? parts.join(' ') : '';
}

function verdictBadge(verdict: FinalReport['verdict']): string {
  const color = verdict === 'PASS' ? 'brightgreen' : verdict === 'WARN' ? 'yellow' : 'red';
  return `![${verdict}](https://img.shields.io/badge/verdict-${verdict}-${color})`;
}

function severityBadge(severity: Severity): string {
  const colorBySeverity: Record<Severity, string> = {
    Blocker: 'red',
    Critical: 'red',
    Major: 'orange',
    Minor: 'yellow',
    Info: 'blue',
  };

  return `![${severity}](https://img.shields.io/badge/${severity}-${severity}-${colorBySeverity[severity]})`;
}
