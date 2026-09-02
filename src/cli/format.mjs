export function formatIssues({ errors, warnings }) {
  const lines = [];
  for (const issue of [...errors, ...warnings]) {
    lines.push(`${issue.code.startsWith('E') ? '✖' : '⚠'} ${issue.code} ${issue.path}`);
    lines.push(`    ${issue.message}`);
  }
  lines.push(`${errors.length} error(s), ${warnings.length} warning(s)`);
  return lines.join('\n') + '\n';
}
