#!/usr/bin/env node
const COMMANDS = new Set(['validate', 'build', 'serve', 'app', 'version', 'news']);
const USAGE = `usage: altsource <command> [options]

commands:
  validate   check source.meta.json, apps/, news/ (add --check-urls to probe every URL)
  build      write dist/source.pal.json, dist/source.json, assets and public files
  serve      build, then serve dist/ locally (default port 4173)
  app        add | list | remove apps   (altsource app --help)
  version    add a version to an app    (altsource version --help)
  news       add a news item            (altsource news --help)
`;

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === '--help' || cmd === '-h') {
  process.stdout.write(USAGE);
  process.exit(cmd ? 0 : 1);
}
if (!COMMANDS.has(cmd)) {
  process.stderr.write(`unknown command: ${cmd}\n${USAGE}`);
  process.exit(1);
}
const { run } = await import(`../src/cli/${cmd}.mjs`);
process.exitCode = await run(rest, { cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr });
