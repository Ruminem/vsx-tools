- 여기까지 됨: `--ripe` 첫 지적 15건(기록 전체로는 32건)을 훑었더니 전부 오탐이었음 — GitHub 저장소 이름 8, 다른 곳의 경로 12, gitignore 된 생성물 6, 하위 폴더 기준 상대 경로 6. `deadPaths` 가 무시 경로 · 하위 폴더 아래 경로 · 이 저장소 얘기가 아닌 경로(첫 칸이 지금 폴더도 옛 최상위 폴더도 아님)를 넘기게 조였고, `stubborn` 은 마지막 기록에 아직 있는 지적만 셈. 지적 0건. 검사가 4.0초 → 6.4초(저장소마다 git 두 번 더, 한 번에 0.15초 안팎은 프로세스 띄우는 값)
- 다음 할 것: 실제 확장 하나로 `install` 돌려 보기. native-toolbelt 가 소스 59KB 인데 CLAUDE.md 가 없어 `MISSING` 으로 뜸 — 지도를 쓸지도 정함
- 막힌 것: 없음. SessionEnd 훅 기본 제한은 1.5초라(공식 문서) `settings.json` 의 `--record` 항목에서 `timeout: 30` 을 지우면 기록이 잘림

- 여기까지 됨: `vsx.js` 의 status / pack / install / docs. `docs` 는 dev 폴더 아래 git 저장소를 전부 돌며 CLAUDE.md 가 있는지, 그 지도가 가리키는 경로가 아직 있는지, 지도가 바뀐 뒤 커밋이 얼마나 쌓였는지 봄. `docs --record` 는 같은 검사를 조용히 돌려 달라진 결과만 `docs-log.jsonl` 에 적음(SessionEnd 훅, 1.4초). `docs --ripe` 는 그 로그만 읽어 기록 3번을 2주에 걸쳐 살아남은 지적이 있을 때만 세션에 알림(SessionStart 훅, 0.09초). 경로 판정·중복 판정·무르익음 판정은 `node vsx.js docs --selftest` 가 지킴
- 다음 할 것: `--ripe` 첫 지적 훑기. 실제로 입을 열 때까지 기다림(가장 이른 시점이 2주 뒤). 그때 지적을 훑어 오탐이면 경로 규칙을 조이고, 진짜면 그 CLAUDE.md 를 고침. 실제 확장 하나로 `install` 을 돌려 설치까지 확인
- 막힌 것: 없음. 훅이 LLM 을 부를 수 있는 이벤트는 도구 이벤트(PreToolUse 등)뿐이라 SessionEnd/SessionStart 에서는 판단을 모델에 맡길 수 없음. 그래서 무르익음을 산수로(기록 횟수 × 기간) 재고, 결과만 SessionStart 의 additionalContext 로 넘겨 모델이 읽게 했음
