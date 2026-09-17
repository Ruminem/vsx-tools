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

### 라이선스

MIT
