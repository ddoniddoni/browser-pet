# Browser Pet 개발 안내

[제품 소개](../README.md) / [사용 안내](USER_GUIDE.md) / [현재 진행 기록](PROGRESS.md)

기존 README의 개발 기준, 실행 명령, 초기 프로젝트 구성 지시문을 보관한 문서다. P0 첫 지시문과 단계별 설명은 프로젝트 시작 당시의 기록이며, 현재 구현 상태와 작업 범위는 진행 기록 및 최신 사용자 요청을 따른다.

## 1. 이번에 만들 것

같은 프로필의 일반 웹페이지에서 선택한 펫 한 마리와 함께한다. 이 펫은 지금 보이는 웹페이지 안을 산책하다가 멈추거나 잠들고, 클릭과 드래그에 반응한다. 팝업을 닫아도 보인다.

처음에는 오른쪽 아래에서 출발한다. 걷는 동안 방향을 바꾸고, 화면 가장자리에 닿으면 안쪽으로 돌아선다. 스크롤해도 지금 보이는 화면 안에 머문다. 주소창이나 바탕화면으로는 이동하지 않는다.

## 2. 확정한 개발 기준

| 항목 | 결정 |
| --- | --- |
| 개발 도구 | WXT, React, TypeScript, npm |
| 실행 환경 | 데스크톱 Chrome, Manifest V3 |
| 화면 구현 | Content Script, Shadow DOM, CSS |
| 이동 | requestAnimationFrame 기반 자체 경량 엔진 |
| 저장 | Chrome Storage Local, Background 단일 쓰기 경로 |
| 캐릭터 | 다락방의 세 친구 중 한 마리. 번들에 포함된 전용 원화와 프로젝트의 입체 모형 사용 |
| 테스트 | Vitest, React Testing Library, Playwright Chromium, 실제 Chrome 수동 검증 |
| 서버 | 없음 |
| 초기 수익화 | 없음 |

기술 동작의 공식 근거와 구현 시 다시 확인할 문서는 [테스트 및 출시 문서](05_TESTING_AND_RELEASE.md)의 출처 표에 모았다. 제품 수치와 일정 순서는 이 프로젝트의 설계 결정이며 외부 사실이나 성능 보장이 아니다.

## 3. 파일 안내

| 파일 | 역할 |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Codex가 지켜야 할 짧은 상시 규칙 |
| [docs/01_PRODUCT_AND_UX.md](01_PRODUCT_AND_UX.md) | 목표, 요구사항 ID, 화면과 조작, MVP 범위 |
| [docs/02_ARCHITECTURE_AND_DATA.md](02_ARCHITECTURE_AND_DATA.md) | 확장 구조, 권한, 공유 상태, 메시지, 저장 일관성 |
| [docs/03_PET_ENGINE_AND_ASSETS.md](03_PET_ENGINE_AND_ASSETS.md) | 이동과 행동 상태 머신, 드래그, 애니메이션, 에셋 계약 |
| [docs/04_IMPLEMENTATION_PLAN.md](04_IMPLEMENTATION_PLAN.md) | P0~P7의 구현 범위와 완료 조건, 후속 지시문 |
| [docs/05_TESTING_AND_RELEASE.md](05_TESTING_AND_RELEASE.md) | 자동 테스트, 수동 검증, 성능, 배포 전 확인, 공식 출처 |
| [docs/PROGRESS.md](PROGRESS.md) | 현재 단계, 실제 검증 결과, 결정과 다음 작업 |

별도 기능 문서를 계속 추가하지 않는다. 해당 주제의 기존 문서를 갱신하고 진행 기록을 남긴다.

## 4. 시작 방법

### 문서를 배치한다

새 `browser-pet` 폴더에 압축을 풀고 VS Code로 그 폴더를 연다. **열린 프로젝트 루트에 `AGENTS.md`와 `docs/`가 있어야 한다.** 폴더가 두 겹으로 풀렸다면 실제 문서가 있는 안쪽 폴더를 연다.

기존 프로젝트에 넣는 경우 `AGENTS.md`, `README.md`, `docs/`를 무조건 덮어쓰지 말고 기존 규칙과 병합한다.

### Codex에 첫 지시문을 넣는다

```text
이 프로젝트의 AGENTS.md, README.md, docs/PROGRESS.md,
docs/04_IMPLEMENTATION_PLAN.md를 먼저 읽어줘.
현재 디렉터리와 기존 파일을 확인하고, 필요한 상세 문서를 읽은 다음
P0만 구현해줘. 이번 요청은 P0 범위의 구현 승인이다.

목표는 WXT + React + TypeScript + npm 기반 Chrome MV3 프로젝트를 구성하고,
팝업과 Background PING/PONG, 일반 웹페이지의 테스트 표시를 확인할 수 있게 만드는 거야.

기존 문서를 덮어쓰지 말고 공식 React 템플릿과 현재 호환 버전을 확인해 병합해줘.
아직 최종 캐릭터 에셋은 없으니 구매나 임의 다운로드는 하지 마.

작업 전 구현 범위와 수정할 파일을 짧게 설명하고 진행해줘.
타입 검사, 린트, 단위 테스트, 프로덕션 빌드를 실제로 실행해줘.
Chrome에서 직접 확인할 수 없는 항목은 미검증으로 표시하고 확인 방법을 알려줘.

docs/PROGRESS.md에 실제 결과를 기록하고 P0에서 멈춰줘.
Git 초기화, 브랜치 변경, 커밋, push, 배포는 하지 마.
```

P0의 결과는 아직 돌아다니는 고양이가 아니라 **정상 작동하는 확장 프로그램 기반**이다. P1에서 임시 고양이가 나타나고 P2에서 산책하기 시작한다.

### 구현 후 실행한다

아래 명령은 **Codex가 P0를 구현한 뒤** 사용한다.

```bash
npm install
npm run dev
```

WXT 개발 모드가 사용하는 브라우저는 사용자의 평소 Chrome 프로필과 다를 수 있다. 실제 환경 검증은 별도로 진행한다. 프로덕션 동작은 다음 경로로 확인한다.

```bash
npm run build
```

Chrome에서 `chrome://extensions`를 열고 개발자 모드를 켠 뒤, '압축해제된 확장 프로그램을 로드합니다'로 빌드 산출물 디렉터리를 선택한다. 기본 예상 경로는 `.output/chrome-mv3`이지만, **실제 WXT 출력과 `manifest.json` 위치를 확인해 사용한다.** 이 문서 ZIP을 Chrome에 직접 설치하는 것이 아니다.

최초 설치, 확장 새로고침 또는 권한 변경 후에는 이미 열어 둔 일반 웹페이지를 새로고침한다. Chrome 내부 페이지에서 펫이 보이지 않는 것은 정상이다.

### 산책과 상호작용 검증

`npm run check`로 타입, 린트, 단위 테스트와 프로덕션 빌드를 검사한다. E2E는 아래 명령으로 실행한다.

```bash
npx playwright install chromium
npm run test:e2e
```

두 번째 명령은 프로덕션 빌드, 로컬 테스트 서버와 임시 프로필의 Chromium을 준비한다. 실제 탭 가시성을 확인하므로 브라우저 창을 열 수 있는 환경에서 실행한다.

## 5. 이후 작업 지시

한 단계가 끝났으면 먼저 결과를 확인하고 다음처럼 지시한다.

```text
AGENTS.md와 docs/PROGRESS.md를 읽고 실제 코드와 진행표를 대조해줘.
직전 단계의 필수 검증이 남아 있다면 그것부터 처리해줘.
선행 조건이 충족됐다면 docs/04_IMPLEMENTATION_PLAN.md의 다음 미완료 단계 하나만 구현해줘.
검사 결과와 미검증 항목을 PROGRESS.md에 기록하고 멈춰줘.
P7 선택 기능은 별도 요청 전에는 시작하지 마.
```

코드 검사가 통과했더라도 실제 Chrome에서 화면을 확인하지 않았다면 완성으로 간주하지 않는다. 수동 확인이 필요한 단계에서는 그 결과를 먼저 기록한다.

## Chrome 웹 스토어 준비 자료

[0.1.0 출시 준비표](release/SUBMISSION.md)에 권한별 설명, 스토어 이미지, QA 남은 항목을 정리했다. [네 언어 등록 문안](release/STORE_LISTING.md)과 [개인정보 처리방침 HTML](release/privacy.html)은 제출용 자료다. 출시 후보 ZIP은 `npm run zip`으로 생성한다. 패키징은 업로드나 스토어 공개를 뜻하지 않는다.

## 6. 첫 출시까지의 구분

- **P0~P2:** 확장이 설치되고 고양이가 보이며 움직이는 기술 시제품.
- **P3~P6:** 상호작용, 저장 안정성, 숨김과 최적화를 갖춘 MVP. P6는 출시 준비까지이며 제출은 별도 승인 사항.
- **P7:** 선택 확장. 밥 주기와 성장 또는 강아지 추가를 독립 작업으로 진행한다.

프레임별 움직임은 Content Script에서 처리하고, 서버 없이 로컬 데이터로 시작한다. 사용자 피드백을 받은 후에 육성과 꾸미기에 투자한다.
