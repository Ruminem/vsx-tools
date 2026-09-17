#!/usr/bin/env node
// SPDX-License-Identifier: MIT
'use strict';
/**
 * One place to see and build every VS Code extension under the dev folder.
 *
 *   node vsx.js status                  version, installed version, git state per extension
 *   node vsx.js pack    <folder...|--all>   build .vsix and collect it in dist/
 *   node vsx.js install <folder...|--all>   pack, then install into VS Code
 *
 * Each extension keeps its own build: `npm run package` when it has one, plain vsce otherwise.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.env.VSX_ROOT || path.join(__dirname, '..');
const DIST = path.join(__dirname, 'dist');

/** Run a command; null on failure instead of throwing, since most checks are optional. */
const sh = (cmd, cwd) => {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

function findExtensions() {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const dir = path.join(ROOT, d.name);
      try {
        const p = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        if (!p.engines?.vscode) return [];
        return [{ dir, folder: d.name, id: `${p.publisher}.${p.name}`.toLowerCase(), version: p.version, scripts: p.scripts || {} }];
      } catch {
        return [];
      }
    });
}

function installedVersions() {
  const out = sh('code --list-extensions --show-versions') || '';
  return new Map(out.split(/\r?\n/).filter(Boolean).map((line) => {
    const at = line.lastIndexOf('@');
    return [line.slice(0, at).toLowerCase(), line.slice(at + 1)];
  }));
}

function status() {
  const installed = installedVersions();
  const rows = findExtensions().map((e) => {
    const isGit = sh('git rev-parse --git-dir', e.dir) !== null;
    const dirty = isGit ? (sh('git status --porcelain', e.dir) || '').split('\n').filter(Boolean).length : null;
    return {
      folder: e.folder,
      version: e.version,
      installed: installed.get(e.id) || '-',
      branch: isGit ? sh('git rev-parse --abbrev-ref HEAD', e.dir) : '-',
      dirty: dirty === null ? '-' : String(dirty),
      unpushed: isGit ? (sh('git rev-list --count @{u}..HEAD', e.dir) ?? 'no upstream') : '-',
      tagged: isGit ? (sh(`git tag --list v${e.version}`, e.dir) ? 'yes' : 'no') : '-',
    };
  });
  if (!rows.length) return console.log(`${ROOT} 아래에서 확장을 찾지 못했습니다.`);

  const cols = Object.keys(rows[0]);
  const width = cols.map((c) => Math.max(c.length, ...rows.map((r) => r[c].length)));
  const line = (r) => cols.map((c, i) => r[c].padEnd(width[i])).join('  ');
  console.log(line(Object.fromEntries(cols.map((c) => [c, c]))));
  for (const r of rows) console.log(line(r));
}

/** Build one extension and return the path of the fresh .vsix. */
function pack(e) {
  const started = Date.now();
  const cmd = e.scripts.package ? 'npm run package' : 'npx --yes @vscode/vsce package';
  console.log(`\n[${e.folder}] ${cmd}`);
  // stdin ignored so a vsce prompt fails fast instead of hanging.
  execSync(cmd, { cwd: e.dir, stdio: ['ignore', 'inherit', 'inherit'] });

  // Only files written by this build count; older .vsix files may sit in the folder.
  const fresh = fs.readdirSync(e.dir)
    .filter((f) => f.endsWith('.vsix'))
    .map((f) => ({ f, t: fs.statSync(path.join(e.dir, f)).mtimeMs }))
    .filter((x) => x.t >= started - 1000)
    .sort((a, b) => b.t - a.t);
  if (!fresh.length) throw new Error(`[${e.folder}] 빌드는 끝났지만 새 .vsix 파일이 없습니다.`);

  fs.mkdirSync(DIST, { recursive: true });
  const out = path.join(DIST, fresh[0].f);
  fs.copyFileSync(path.join(e.dir, fresh[0].f), out);
  console.log(`[${e.folder}] -> ${out}`);
  return out;
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'status' || !cmd) return status();
  if (cmd !== 'pack' && cmd !== 'install') {
    console.error('사용법: node vsx.js status | pack <folder...|--all> | install <folder...|--all>');
    process.exit(2);
  }

  const all = findExtensions();
  const picked = args.includes('--all') ? all : args.map((a) => all.find((e) => e.folder === a) || a);
  const unknown = picked.filter((p) => typeof p === 'string');
  if (!picked.length || unknown.length) {
    console.error(`확장 폴더를 지정하세요. 모르는 이름: ${unknown.join(', ') || '(없음)'}`);
    console.error(`있는 것: ${all.map((e) => e.folder).join(', ')}`);
    process.exit(2);
  }

  const failed = [];
  for (const e of picked) {
    try {
      const vsix = pack(e);
      if (cmd === 'install') execSync(`code --install-extension "${vsix}" --force`, { stdio: ['ignore', 'inherit', 'inherit'] });
    } catch (err) {
      failed.push(e.folder);
      console.error(`[${e.folder}] 실패: ${err.message.split('\n')[0]}`);
    }
  }
  if (failed.length) {
    console.error(`\n실패 ${failed.length}개: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main();
