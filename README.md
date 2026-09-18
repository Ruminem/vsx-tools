# vsx-tools

**English** · [한국어](#korean)

See and build every VS Code extension that lives next to this folder.

## Usage

```sh
node vsx.js status                       # version, installed version, git state
node vsx.js pack    hover-decode         # build .vsix into dist/
node vsx.js install --all                # build everything and install into VS Code
```

An extension is any sibling folder whose `package.json` has `engines.vscode`.
Each one builds its own way: `npm run package` if it defines it, otherwise `vsce package`.
Set `VSX_ROOT` to scan a different folder.

`dist/` collects the latest `.vsix` files, handy for copying to another machine.

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
```

형제 폴더 중 `package.json` 에 `engines.vscode` 가 있는 것을 확장으로 봄.
빌드는 확장마다 제 방식대로 함. `npm run package` 가 있으면 그것을, 없으면 `vsce package` 를 부름.
다른 폴더를 훑으려면 `VSX_ROOT` 를 지정함.

`dist/` 에 최신 `.vsix` 파일이 모임. 다른 PC 로 옮길 때 편함.

### 설치 페이지

새 PC 에서는 https://ruminem.github.io/vsx-tools/?lang=ko 를 열고 확장마다 VS Code에서 열기를 누른 뒤 VS Code 에 뜬 페이지에서 Install 을 누름. 또는 맨 아래
`code --install-extension …` 한 줄 명령을 복사해 돌리면 확인 없이 전부 설치됨.
그 아래에는 `--force` 를 붙인 명령이 있음. 전부 최신 버전으로 업데이트함.
페이지는 마켓플레이스로 연결되므로 로컬 빌드가 아니라 배포된 버전이 설치됨.
새 확장을 배포하면 `index.html` 의 `EXTENSIONS` 에 한 줄 추가함.

### 라이선스

MIT
