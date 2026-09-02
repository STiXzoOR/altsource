import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);
const defaultExec = (cmd, args) => execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024 });

export const releaseBase = (repo, tag) => `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}`;

/** Create the GitHub release if needed and upload every file (gh must be authenticated). */
export async function publishRelease({ repo, tag, notes = '', files, exec = defaultExec }) {
  let created = false;
  try {
    await exec('gh', ['release', 'view', tag, '--repo', repo]);
  } catch {
    await exec('gh', ['release', 'create', tag, '--repo', repo, '--title', tag, '--notes', notes]);
    created = true;
  }
  await exec('gh', ['release', 'upload', tag, ...files.map((f) => f.path), '--repo', repo, '--clobber']);
  const base = releaseBase(repo, tag);
  return { created, base, assets: files.map((f) => `${base}/${f.name}`) };
}
