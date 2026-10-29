# Pocket Roo

화면 구석에 띄워두는 픽셀 캥거루 킥복싱 게임입니다 (Electron + Vite + TypeScript). 그래픽은 `src/rendering/PixelAssets.ts`의 문자열 스프라이트로 코드에서 그립니다.

- 테스트: `pnpm test` / 타입 검사: `pnpm typecheck` / 실행: `pnpm dev`

## 커밋과 push

- 커밋과 push는 사용자가 직접 요청할 때만 합니다. "버전업 해"처럼 작업만 요청받았으면 파일만 고치고 커밋하지 않습니다.
- `master`에 버전이 바뀐 커밋이 push되면 `.github/workflows/release.yml`이 앱을 빌드해 GitHub Release를 공개로 올립니다. push가 곧 공개 릴리스라는 점을 사용자에게 알립니다.

## 버전을 올릴 때

1. `package.json`의 `version`
2. README의 내려받기 링크 (`x.y.z`가 들어간 파일 이름과 `vx.y.z` 경로 모두)
3. README `버전 기록`의 맨 위에 `### x.y.z` 항목 (사용자가 읽을 문장으로, 무엇이 바뀌었는지). GitHub Release 노트는 `scripts/release-notes.mjs`가 이 항목으로 만들고, 항목이 없으면 릴리스 워크플로가 실패합니다. `node scripts/release-notes.mjs`로 확인합니다.
4. 아래의 웹사이트 갱신

## 웹사이트도 같이 고칩니다

[bubuddy-dev.github.io](https://github.com/bubuddy-dev/bubuddy-dev.github.io)의 게임 페이지(`games/pocket-roo/index.html`)는 모든 내용을 HTML에 직접 적어 둡니다. 이 레포에서 아래 내용이 바뀌는 작업을 했으면, 사용자가 따로 말하지 않아도 그 작업 안에서 사이트 HTML까지 고칩니다. 웹사이트 레포는 이 레포 옆의 `../bubuddy-dev.github.io`에 있습니다 (없으면 사용자에게 위치를 묻습니다).

| 이 레포에서 바뀐 것 | 사이트에서 고칠 곳 |
| --- | --- |
| README `버전 기록`에 새 항목 | `games/pocket-roo/index.html`의 `패치 노트` 맨 위에 같은 내용의 `<h3>x.y.z</h3>` + `<ul>` |
| README `## 조작` (키 추가·변경) | `games/pocket-roo/index.html`의 `#tab-controls` 표 |
| README `### macOS` / `### Windows` / `### 업데이트` | `games/pocket-roo/index.html`의 `#tab-install` |
| `docs/screenshot.png` | `../bubuddy-dev.github.io/assets/games/pocket-roo-screenshot.png`로 복사, `.shot` 이미지 alt를 README alt와 같게 |
| `build/icon.png` (1024px) | `sips -z 256 256 build/icon.png --out ../bubuddy-dev.github.io/assets/games/pocket-roo-icon.png` |
| README 맨 위 소개나 모드 구성이 | `games/pocket-roo/index.html`의 `<meta name="description">`, `.game-head` 부제, 첫 소개 문단, `index.html` 갤러리 타일의 `title` |

- 사이트 문장은 README를 그대로 옮기지 않고 사이트 형식에 맞춥니다. 조작 표는 `<kbd>` 키 표, 설치 방법은 "위의 내려받기 버튼으로 … 파일을 받습니다"처럼 씁니다. `.zip` 안내는 넣지 않습니다(사이트 버튼은 설치 파일만 받습니다).
- **사이트에는 GitHub 링크를 하나도 두지 않습니다.** README의 링크(내려받기 파일, `#받기` 같은 앵커, 릴리스·비교 주소)는 글자만 옮기거나 빼고, 패치 노트에도 링크나 `@아이디`를 넣지 않습니다.
- 캐릭터나 화면 모습이 바뀌었는데 `docs/screenshot.png`가 그대로면 스크린샷을 새로 찍습니다. `pnpm build` 후 `CK_CAPTURE_PATH=<파일> CK_CAPTURE_KEYS=<키> node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .`로 앱을 띄워 창을 저장할 수 있습니다(`electron/main.ts`의 `scheduleDebugCapture` 참고).
- 다 고친 뒤 사이트 HTML에 `github`가 남지 않았는지 `grep -ri github ../bubuddy-dev.github.io/index.html ../bubuddy-dev.github.io/games`로 확인합니다.

웹사이트 레포에서도 커밋과 push는 하지 않고, 무엇을 바꿨는지 알려줍니다.
