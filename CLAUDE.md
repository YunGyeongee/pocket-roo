# Pocket Roo

화면 구석에 띄워두는 픽셀 캥거루 킥복싱 게임입니다 (Electron + Vite + TypeScript). 그래픽은 `src/rendering/PixelAssets.ts`의 문자열 스프라이트로 코드에서 그립니다.

- 테스트: `pnpm test` / 타입 검사: `pnpm typecheck` / 실행: `pnpm dev`

## 커밋과 push

- 커밋과 push는 사용자가 직접 요청할 때만 합니다. "버전업 해"처럼 작업만 요청받았으면 파일만 고치고 커밋하지 않습니다.
- `master`에 버전이 바뀐 커밋이 push되면 `.github/workflows/release.yml`이 앱을 빌드해 GitHub Release를 공개로 올립니다. push가 곧 공개 릴리스라는 점을 사용자에게 알립니다.

## README는 웹사이트의 원본입니다

[bubuddy-dev.github.io](https://github.com/bubuddy-dev/bubuddy-dev.github.io)의 게임 페이지(`games/pocket-roo/`)는 이 레포의 내용을 읽어서 보여줍니다.

- 조작·설치 탭: 기본 브랜치 README의 `## 조작`, `### macOS`, `### Windows`, `### 업데이트` 아래 내용을 그대로 씁니다. 이 제목들은 바꾸거나 지우지 않습니다. 꼭 바꿔야 하면 사이트의 `data-readme` 값도 같이 바꿉니다.
- 패치 노트: GitHub Release 노트를 읽습니다. 릴리스 노트는 README `버전 기록`의 `### x.y.z` 항목에서 `scripts/release-notes.mjs`가 만듭니다. 항목이 없으면 릴리스 워크플로가 실패합니다.

## 버전을 올릴 때

1. `package.json`의 `version`
2. README의 내려받기 링크 (`x.y.z`가 들어간 파일 이름과 `vx.y.z` 경로 모두)
3. README `버전 기록`의 맨 위에 `### x.y.z` 항목 (사용자가 읽을 문장으로, 무엇이 바뀌었는지)
4. `node scripts/release-notes.mjs`로 3번 항목이 제대로 나오는지 확인
5. 아래의 웹사이트 레포 갱신

## 버전을 올리면 웹사이트 레포도 함께 고칩니다

웹사이트 레포는 이 레포 옆의 `../bubuddy-dev.github.io`에 있습니다 (없으면 사용자에게 위치를 묻습니다). 글은 자동으로 따라가지만 이미지와 페이지 소개 문구는 직접 맞춰야 합니다. 버전을 올릴 때마다 아래를 확인하고, 다른 것만 고칩니다.

- **스크린샷**: `docs/screenshot.png`와 `../bubuddy-dev.github.io/assets/games/pocket-roo-screenshot.png`가 다르면 복사합니다. 캐릭터나 화면 모습이 바뀐 버전인데 `docs/screenshot.png`가 그대로면 스크린샷을 새로 찍어야 한다고 사용자에게 알립니다.
- **스크린샷 설명**: README 스크린샷의 alt 문구와 `games/pocket-roo/index.html`의 `.shot` 이미지 alt가 같게 합니다.
- **아이콘**: `build/icon.png`(1024px)가 바뀌었으면 `sips -z 256 256 build/icon.png --out ../bubuddy-dev.github.io/assets/games/pocket-roo-icon.png`로 256px 사본을 만듭니다.
- **소개 문구**: README 맨 위 소개나 모드 구성이 바뀌었으면 `games/pocket-roo/index.html`의 `<meta name="description">`, `.game-head` 부제, 첫 소개 문단, `index.html` 갤러리 타일의 `title`도 맞춥니다.
- 조작·설치·패치 노트는 사이트에 직접 쓰지 않습니다. README만 고칩니다.

웹사이트 레포에서도 커밋과 push는 하지 않고, 무엇을 바꿨는지 알려줍니다. push 순서는 이 레포가 먼저, 웹사이트가 나중입니다. README가 먼저 올라가야 사이트에 새 내용이 보입니다.
