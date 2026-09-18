# vsx-tools

**English** · [한국어](#korean)

See and build every VS Code extension that lives next to this folder.

## Usage

```sh
node vsx.js status                       # version, installed version, git state
node vsx.js pack    hover-decode         # build .vsix into dist/
node vsx.js install --all                # build everything and install into VS Code
node vsx.js docs                         # CLAUDE.md coverage and staleness, every repo here
node vsx.js docs --record                # same scan, but files changed findings and prints nothing
node vsx.js docs --ripe                  # speaks only when that log has complaints worth triaging
```

An extension is any sibling folder whose `package.json` has `engines.vscode`.
Each one builds its own way: `npm run package` if it defines it, otherwise `vsce package`.
Set `VSX_ROOT` to scan a different folder.

`dist/` collects the latest `.vsix` files, handy for copying to another machine.

## Keeping CLAUDE.md honest

`docs` is the one command that looks at every git repo under the dev folder, not just extensions.
A `CLAUDE.md` is a map an agent reads at the start of every session, and it goes stale quietly:
files move, the map keeps pointing at where they were. The table shows how much source each repo
has, whether it has a map, how many paths that map names but that nothing answers to, and how many
commits have landed since the map itself last changed.

It only flags a backticked token with a directory in it (`win-cursor/build.py`, not `build.py`),
because a bare name cannot be told apart from the dotted things docs are full of. Even so, a doc
legitimately names paths it does not own — a release URL, a build temp folder, another repo — so
read the list, do not gate on it. `MISSING` in the CLAUDE.md column only appears past 50KB of
source; below that, reading the code beats writing a map for it.

### Collecting the false alarms

`--record` runs the same scan, appends the findings to `docs-log.jsonl` and prints nothing. It is
meant for a `SessionEnd` hook, so the log fills while you work instead of when you remember to look.

It only writes when the findings differ from the last entry. The scan is deterministic, so an
unchanged result is not news, and logging it every session would bury the few lines that are.

The point is to build the evidence for tightening the rules: after a few weeks the log shows which
complaints keep coming back and were never worth fixing. Until that list exists the scan cannot be
trusted to run unattended, which is why nothing here warns, blocks or exits non-zero.

`--ripe` reads that log — and nothing else, so it is instant and belongs on a `SessionStart` hook.
It stays silent until some complaint has survived three recordings spread over a fortnight, and
only then prints the JSON that hands the session a note about it. A complaint recorded once and
gone by the next was real rot that got fixed; one that neither gets fixed nor goes away is the
shape of a false alarm, and the evidence needed to rule against it.

## Install page

On a new machine, open https://ruminem.github.io/vsx-tools/?lang=en and press Open in VS Code next to
each extension, then Install on the page VS Code shows. Or copy the one-line `code --install-extension …` command at the bottom, which installs everything without asking.
A second command below it adds `--force`, which updates every extension to its latest version.
The page links to the Marketplace, so it installs the published versions, not local builds.
When a new extension is published, add a line to `EXTENSIONS` in `index.html`.

## License

MIT

---

## Korean

[English](#vsx-tools) · **한국어**

이 폴더 옆에 있는 VS Code 확장을 전부 한눈에 보고 빌드함.

### 사용법

```sh
node vsx.js status                       # 버전, 설치된 버전, git 상태
node vsx.js pack    hover-decode         # .vsix 를 빌드해 dist/ 에 모음
node vsx.js install --all                # 전부 빌드해서 VS Code 에 설치
node vsx.js docs                         # 여기 있는 저장소 전부의 CLAUDE.md 상태
node vsx.js docs --record                # 같은 검사. 달라진 것만 적어 두고 아무것도 찍지 않음
node vsx.js docs --ripe                  # 그 기록에 추릴 만한 것이 쌓였을 때만 입을 엶
```

형제 폴더 중 `package.json` 에 `engines.vscode` 가 있는 것을 확장으로 봄.
빌드는 확장마다 제 방식대로 함. `npm run package` 가 있으면 그것을, 없으면 `vsce package` 를 부름.
다른 폴더를 훑으려면 `VSX_ROOT` 를 지정함.

`dist/` 에 최신 `.vsix` 파일이 모임. 다른 PC 로 옮길 때 편함.

### CLAUDE.md 가 썩지 않게

`docs` 만은 확장이 아니라 dev 폴더 아래 git 저장소를 전부 봄.
`CLAUDE.md` 는 에이전트가 세션마다 읽는 지도인데 조용히 썩음. 파일이 옮겨져도 지도는 그대로임.
표에 저장소별 소스 크기, 지도 유무, 지도가 가리키는데 없는 경로 수, 지도가 마지막으로 바뀐 뒤
쌓인 커밋 수가 나옴.

백틱 안에 있고 폴더가 붙은 것만 봄(`build.py` 말고 `win-cursor/build.py`). 이름만 있으면 문서에
널린 점 찍힌 것들과 구분이 안 되기 때문임. 그래도 문서는 제 것이 아닌 경로도 정당하게 언급함 —
릴리스 주소, 빌드 임시 폴더, 다른 저장소. 그러니 목록은 읽어 보는 용도지 막는 용도가 아님.
`CLAUDE.md` 칸의 `MISSING` 은 소스가 50KB 를 넘을 때만 뜸. 그 아래면 지도를 쓰느니 코드를 읽는 게 나음.

#### 오탐 모으기

`--record` 는 같은 검사를 돌리되 결과를 `docs-log.jsonl` 에 적고 아무것도 찍지 않음. `SessionEnd`
훅에 걸어 두라고 만든 것임. 생각나서 돌려 보는 때가 아니라 일하는 동안 로그가 쌓임.

직전에 적힌 것과 달라졌을 때만 씀. 검사가 결정적이라 안 바뀐 결과는 소식이 아니고, 매 세션 적으면
정작 소식인 몇 줄이 묻힘.

목적은 규칙을 조일 근거를 모으는 것임. 몇 주 지나면 어떤 지적이 계속 나오면서 한 번도 고칠 값어치가
없었는지 로그에 보임. 그 목록이 생기기 전까지는 이 검사를 사람 없이 돌게 둘 수 없음. 여기 있는 어떤
것도 경고하거나 막거나 0 아닌 값으로 끝나지 않는 이유가 그것임.

`--ripe` 는 그 로그만 읽음. 다른 건 안 봐서 즉시 끝나므로 `SessionStart` 훅 자리임. 어떤 지적이
기록 세 번을 2주에 걸쳐 살아남기 전까지는 아무 말도 안 하고, 그때만 세션에 알리는 JSON 을 찍음.
한 번 기록되고 다음엔 사라진 지적은 진짜 썩음이라 누가 고친 것임. 고쳐지지도 사라지지도 않는 것이
오탐의 모양이고, 규칙으로 쳐낼 근거임.

### 설치 페이지

새 PC 에서는 https://ruminem.github.io/vsx-tools/?lang=ko 를 열고 확장마다 VS Code에서 열기를 누른 뒤 VS Code 에 뜬 페이지에서 Install 을 누름. 또는 맨 아래
`code --install-extension …` 한 줄 명령을 복사해 돌리면 확인 없이 전부 설치됨.
그 아래에는 `--force` 를 붙인 명령이 있음. 전부 최신 버전으로 업데이트함.
페이지는 마켓플레이스로 연결되므로 로컬 빌드가 아니라 배포된 버전이 설치됨.
새 확장을 배포하면 `index.html` 의 `EXTENSIONS` 에 한 줄 추가함.

### 라이선스

MIT
