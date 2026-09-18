#!/usr/bin/env node
// SPDX-License-Identifier: MIT
'use strict';
/**
 * One place to see and build every VS Code extension under the dev folder.
 *
 *   node vsx.js status                  version, installed version, git state per extension
 *   node vsx.js pack    <folder...|--all>   build .vsix and collect it in dist/
 *   node vsx.js install <folder...|--all>   pack, then install into VS Code
 *   node vsx.js docs [--record]         CLAUDE.md coverage and staleness, every repo here
 *                                       --record files changed findings in docs-log.jsonl, silently
 *                                       --ripe   tells the session when that log has complaints worth triaging
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
  table(rows, '확장을 찾지 못했습니다.');
}

/** Print rows as an aligned table, using the first row's keys as the header. */
function table(rows, empty) {
  if (!rows.length) return console.log(`${ROOT} 아래에서 ${empty}`);
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

// --- CLAUDE.md ------------------------------------------------------------
// A map goes stale quietly: files move, the map keeps pointing at where they were. Nothing can
// tell whether the prose is still true, so this only looks for evidence that it is not.

const MAP = 'CLAUDE.md';
const NEEDS_MAP = 50 * 1024;  // source past this is worth a map (~1,500 lines); below it, reading beats a map
const OLD_COMMITS = 30;       // commits piled on top of the map's own commit before it is worth a look
const SOURCE = /\.(js|mjs|cjs|ts|tsx|jsx|py|dart|cs|cpp|cc|hpp?|ps1|go|rs|java|kt|rb|php|swift|lua|sh)$/i;

/** Every git repo under the dev folder, extension or not. */
function findProjects() {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, '.git')))
    .map((d) => ({ folder: d.name, dir: path.join(ROOT, d.name) }));
}

/**
 * Paths the map names, as written. The bar is high on purpose: a checker that cries wolf gets
 * ignored, which is worse than no checker. So only a backticked token with a directory in it
 * counts — `win-cursor/build.py`, not `build.py`. A bare name cannot be told apart from the
 * dotted things docs are full of (`mapFile.matchTargets`, `assist.roundTrip`, `api.github.com`,
 * `0.13`), and a bare filename is often one the doc discusses without owning (`colors.xml` inside
 * an apk, `compile_commands.json` the build writes). Placeholders, globs, URLs and paths that
 * leave the repo are nothing this can check.
 */
function citedPaths(text) {
  const out = new Set();
  for (const [, tok] of text.matchAll(/`([^`\n]+)`/g)) {
    // Word chars, dots, hyphens and slashes only, with at least one slash. Everything else a doc
    // puts in backticks fails this: globs, `<placeholders>`, `$shell`, urls (the colon), windows
    // paths, `~/home`, and dotted names with no slash at all.
    if (!/^[\w.-]+(\/[\w.-]*)+$/.test(tok) || tok.startsWith('../')) continue;
    out.add(tok.replace(/^\.\//, ''));
  }
  return [...out];
}

/** Of those, the ones nothing answers to. */
function deadPaths(dir, tracked, cited) {
  return cited.filter((p) => {
    if (fs.existsSync(path.join(dir, p))) return false;  // covers files git ignores but that are really there
    return p.endsWith('/') ? !tracked.some((t) => t.startsWith(p)) : !tracked.includes(p);
  });
}

/** The scan itself. docs prints it, --record files it away. */
function scanDocs() {
  const rows = [], broken = [];
  for (const { folder, dir } of findProjects()) {
    const tracked = (sh('git ls-files', dir) || '').split(/\r?\n/).filter(Boolean);
    // Size from stat, not from reading: only the order of magnitude matters here.
    const bytes = tracked.filter((f) => SOURCE.test(f))
      .reduce((n, f) => { try { return n + fs.statSync(path.join(dir, f)).size; } catch { return n; } }, 0);

    const has = fs.existsSync(path.join(dir, MAP));
    let dead = [], since = '-';
    if (has) {
      dead = deadPaths(dir, tracked, citedPaths(fs.readFileSync(path.join(dir, MAP), 'utf8')));
      if (dead.length) broken.push([folder, dead]);
      const at = sh(`git log -1 --format=%H -- ${MAP}`, dir);
      since = at ? (sh(`git rev-list --count ${at}..HEAD`, dir) ?? '-') : 'uncommitted';
    }
    rows.push({
      project: folder,
      source: `${Math.round(bytes / 1024)}KB`,
      'CLAUDE.md': has ? 'yes' : (bytes >= NEEDS_MAP ? 'MISSING' : '-'),
      dead: has ? String(dead.length) : '-',
      'commits since': since,
    });
  }
  return { rows, broken };
}

function docs() {
  const { rows, broken } = scanDocs();
  table(rows, 'git 저장소를 찾지 못했습니다.');
  for (const [folder, dead] of broken) {
    console.log(`\n[${folder}] ${MAP} 가 가리키는데 없는 것:`);
    for (const d of dead) console.log(`  ${d}`);
  }
  const look = rows.filter((r) => r['CLAUDE.md'] === 'MISSING' || Number(r.dead) > 0 || Number(r['commits since']) > OLD_COMMITS);
  console.log(look.length ? `\n볼 것 ${look.length}개: ${look.map((r) => r.project).join(', ')}` : '\n볼 것 없음.');
}

const LOG = path.join(__dirname, 'docs-log.jsonl');

/** Two scans worth comparing: the same complaints about the same projects. */
const sameFindings = (a, b) => !!a && JSON.stringify([a.dead, a.missing]) === JSON.stringify([b.dead, b.missing]);

/**
 * File the findings away and say nothing. Which of them are false alarms is a judgement no scan
 * can make, so this only keeps the raw material: what was reported, and when it started looking
 * that way. The scan is deterministic, so an unchanged result is not news — logging it every
 * session would bury the few lines that are.
 */
function record() {
  const { rows, broken } = scanDocs();
  const now = {
    dead: Object.fromEntries(broken),
    missing: rows.filter((r) => r['CLAUDE.md'] === 'MISSING').map((r) => r.project),
  };
  const lines = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean) : [];
  const last = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
  if (sameFindings(last, now)) return;
  fs.appendFileSync(LOG, `${JSON.stringify({ at: new Date().toISOString(), ...now })}\n`);
}

const RIPE_ENTRIES = 3;  // distinct recordings a complaint must survive before it counts as stubborn
const RIPE_DAYS = 14;    // ...spread over at least this long, so a busy afternoon of edits is not mistaken for months

/**
 * Complaints that keep coming back. A finding recorded once and gone next time was real rot that
 * someone fixed; one that survives recording after recording, for weeks, without anyone touching
 * it is the shape of a false alarm — and a false alarm that has proved it repeats is exactly what
 * a rule should be tightened against. Deciding that needs no judgement, only two counts.
 */
function stubborn(entries) {
  const seen = new Map();
  for (const e of entries) {
    for (const [project, dead] of Object.entries(e.dead || {})) {
      for (const d of dead) {
        const key = `${project}: ${d}`;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push(Date.parse(e.at));
      }
    }
  }
  const days = (ts) => (Math.max(...ts) - Math.min(...ts)) / 86400000;
  return [...seen].filter(([, ts]) => ts.length >= RIPE_ENTRIES && days(ts) >= RIPE_DAYS)
    .map(([key, ts]) => ({ key, times: ts.length, days: Math.round(days(ts)) }));
}

/**
 * Say something only once the log has earned it, and say it to the session rather than the
 * terminal: reading a jsonl of a few dozen lines costs nothing, so this can run at SessionStart
 * where --record would be too slow. Silence the rest of the time is the point — a notice that
 * appears every session is one nobody reads by the third day.
 */
function ripeCheck() {
  if (!fs.existsSync(LOG)) return;
  const entries = fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const old = stubborn(entries);
  if (!old.length) return;
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: [
        `CLAUDE.md 점검 기록(${LOG})에 오래 남은 지적이 ${old.length}건 있다. 고쳐지지도 사라지지도`,
        '않았으니 오탐이거나, 지도가 정말 틀린 채 방치된 것이다. 사용자에게 한 줄로 알리고, 원하면',
        `훑어보고 vsx.js 의 경로 규칙을 조이거나 해당 CLAUDE.md 를 고치겠다고 제안하라. 전체는 \`node ${path.join(__dirname, 'vsx.js')} docs\` 로 본다.`,
        ...old.map((o) => `  ${o.key} — 기록 ${o.times}번, ${o.days}일째`),
      ].join('\n'),
    },
  }));
}

/** The path matching above is the only part with corners; this is what fails if one gets filed off. */
function selftest() {
  const assert = require('assert');
  const cited = citedPaths([
    '`a/build.py` `./b/NEXT.md` `win-cursor/art/`',                       // 경로로 볼 것
    '`build.py` `mapFile.matchTargets` `assist.roundTrip.explain` `0.13`', // 이름만 있는 것 — 안 봄
    '`art/<theme>/x.txt` `*.vsix` `lib{}.a` `$HOME/x.py` `a b/c.py`',      // 자리표시자·글롭·셸
    '`https://x.dev/y` `cursor-playground://apply/x` `~/.claude/CLAUDE.md` `C:/tmp/x.py` `../assets/`',
  ].join(' '));
  assert.deepStrictEqual(cited, ['a/build.py', 'b/NEXT.md', 'win-cursor/art/'], `골라낸 것: ${cited}`);

  const tracked = ['win-cursor/build.py', 'win-cursor/art/amber/arrow.txt', 'README.md'];
  const dead = deadPaths(path.join(__dirname, 'no-such-dir'), tracked,
    ['win-cursor/build.py', 'win-cursor/art/', 'win-cursor/gone.py', 'docs/']);
  assert.deepStrictEqual(dead, ['win-cursor/gone.py', 'docs/'], `죽은 것: ${dead}`);

  const one = { dead: { a: ['x/y.py'] }, missing: [] };
  assert.ok(sameFindings(one, { dead: { a: ['x/y.py'] }, missing: [] }), '같은 결과를 또 적으면 안 된다');
  assert.ok(!sameFindings(one, { dead: { a: ['x/z.py'] }, missing: [] }), '달라진 결과는 적어야 한다');
  assert.ok(!sameFindings(null, one), '첫 줄은 적어야 한다');

  const day = (n) => new Date(Date.UTC(2026, 0, n)).toISOString();
  const log = [
    { at: day(1), dead: { a: ['x/old.py', 'x/fixed.py'] } },   // 둘 다 처음
    { at: day(9), dead: { a: ['x/old.py'] } },                 // fixed.py 는 고쳐져 사라짐
    { at: day(20), dead: { a: ['x/old.py'], b: ['y/new.py'] } }, // new.py 는 이제 막 나옴
  ];
  assert.deepStrictEqual(stubborn(log), [{ key: 'a: x/old.py', times: 3, days: 19 }], JSON.stringify(stubborn(log)));
  assert.deepStrictEqual(stubborn(log.slice(0, 2)), [], '기록 2번뿐이면 아직 이르다');
  console.log('selftest 통과');
}


function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'status' || !cmd) return status();
  if (cmd === 'docs') {
    if (args.includes('--selftest')) return selftest();
    if (args.includes('--record')) return record();
    return args.includes('--ripe') ? ripeCheck() : docs();
  }
  if (cmd !== 'pack' && cmd !== 'install') {
    console.error('사용법: node vsx.js status | docs | pack <folder...|--all> | install <folder...|--all>');
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
