# 02. 아키텍처와 데이터

## 1. 실행 구조

```text
일반 웹페이지 A                          일반 웹페이지 B
Content Script                          Content Script
  ├─ 표시 조건 컨트롤러                    ├─ 표시 조건 컨트롤러
  ├─ Shadow DOM + React UI                ├─ Shadow DOM + React UI
  ├─ 공유 산책 렌더러                     ├─ 공유 산책 렌더러
  └─ 공유 상태 읽기/명령 전송                └─ 공유 상태 읽기/명령 전송
              \                           /
               runtime.sendMessage 명령
                         ↓
              Background Service Worker
              검증 → 직렬 처리 → 상태 저장
                         ↓
               storage.local 단일 루트 키
                         ↓
             storage.onChanged로 각 UI 갱신

팝업 / 옵션 화면 ── 동일한 명령 경로 사용
```

Content Script는 웹페이지 DOM에 UI를 추가하지만 기본 실행 세계는 ISOLATED로 유지한다. MAIN world, 페이지 스크립트 주입, 페이지와의 `postMessage` 브리지는 필요 없다. Shadow DOM은 스타일 분리를 위한 것이며 완벽한 보안 경계가 아니다. 웹페이지의 DOM과 일부 레이아웃 영향은 공유한다. [S1, S2]

Background에는 DOM, 애니메이션 루프, 계속 돌아가는 타이머를 두지 않는다. 저장 명령이나 설치 이벤트가 생겼을 때만 짧게 처리한다. 서비스 워커 메모리는 종료되면 사라질 수 있으므로 영속 상태의 원본은 저장소다. [S4]

## 2. 디렉터리 기준

다음은 목표 구조다. 현재 문서 패키지에는 구현 파일이 없다. 설치한 WXT 버전의 공식 엔트리포인트 규칙을 확인하고 의미가 같은 구조로 조정할 수 있다.

```text
browser-pet/
├── AGENTS.md
├── README.md
├── docs/
├── entrypoints/
│   ├── background.ts
│   ├── pet.content/
│   │   ├── index.tsx
│   │   └── style.css
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   └── options/
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx
├── components/                 # 팝업/옵션의 작은 공통 UI
├── features/
│   └── pet/
│       ├── core/               # DOM 없는 상태 전이, 좌표 계산, RNG 계약
│       ├── runtime/            # rAF, Pointer Events, lifecycle 연결
│       ├── rendering/          # 임시 렌더러, 스프라이트 렌더러
│       ├── ui/                 # PetOverlay, PetMenu
│       └── definitions/        # 캐릭터 메타데이터와 registry
├── shared/
│   ├── contracts/              # 상태/메시지 타입과 런타임 검증
│   ├── storage/                # 키, 읽기 구독, Background 전용 writer
│   ├── messaging/              # 요청/응답 클라이언트
│   └── config/                 # 제품 기본값
├── public/
│   ├── icon/
│   └── pets/                   # 승인된 정적 에셋만
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/               # 로컬 정적 테스트 페이지
├── wxt.config.ts
├── vitest.config.ts
├── playwright.config.ts       # P2에서 도입
├── package.json
└── package-lock.json
```

작은 컴포넌트마다 별도 도메인 폴더를 늘리지 않는다. Redux, Zustand, 게임 엔진, CSS 프레임워크는 기본 의존성에 넣지 않는다. React는 메뉴와 설정 UI를, 순수 TypeScript 엔진은 프레임별 계산을 담당한다.

WXT API는 명시적 `import { browser } from 'wxt/browser'` 사용을 기본으로 한다. 이 문서의 Chrome Storage는 이 래퍼를 통해 호출해도 같은 확장 저장소를 뜻한다. 임의의 별도 polyfill은 추가하지 않는다. [S16]

이전 버전과의 저장 호환을 위해 숨긴 호스트 목록과 입력/전체화면 설정 필드는 읽을 수 있지만 현재 버전의 표시는 전체 스위치와 창/탭 상태로만 결정한다.

## 3. 권한과 실행 조건

### 프로덕션 정책

| 설정 | 기준 |
| --- | --- |
| Manifest | V3 |
| `permissions` | `storage` |
| `optional_permissions` (알람) | `alarms`는 첫 알람을 켤 때, `notifications`는 시스템 알림을 직접 선택할 때만 요청 |
| Content Script `matches` | `http://*/*`, `https://*/*` |
| 실행 시점 | `document_idle` |
| 하위 프레임 | `all_frames: false`, 최상위 문서만 |
| 실행 세계 | ISOLATED |
| about:blank 매칭 | 사용하지 않음 |
| 시크릿 모드 | `not_allowed` |
| 외부 메시지 | `externally_connectable`와 외부 메시지 리스너 없음 |

선언형 Content Script가 페이지에 자동 진입하는 구조로 시작한다. 같은 범위를 `host_permissions`에도 습관적으로 중복 선언하지 않는다. `activeTab`만으로는 사용자 클릭 없이 매 사이트에 항상 나타나는 제품 요구를 만족하지 못하므로 MVP의 기본 모델로 삼지 않는다. 선언형 `matches` 자체도 사이트 접근 범위와 경고를 발생시킬 수 있다. [S2, S5]

`tabs`, `scripting`, `history`, `webRequest`, `cookies`, `notifications`, `alarms`, `offscreen`, `unlimitedStorage`는 MVP에서 요청하지 않는다. WXT 개발 모드가 추가하는 항목과 실제 배포 빌드의 권한을 구별한다. 구현상 새 권한이 필요하다고 판단되면 먼저 다른 설계를 검토하고 근거를 남긴다.

후속 알람 기능은 팝업이나 웹페이지가 닫히고 MV3 워커가 쉬더라도 예약을 처리해야 하므로 페이지 타이머를 사용하지 않는다. 알람은 v4 상태의 선택 필드 `agenda`로 저장한다. 매주 요일과 매월 기준일은 다음 예약일과 별도 보관한다. 이전 `payday` 필드는 호환용으로만 읽으며 표시하거나 예약하지 않는다. 예약 권한을 허용한 프로필은 [Chrome Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)의 이름 있는 예약 하나만 사용한다. 워커 기동과 Chrome 재시작, 일정 변경 시 재조정하며, 만료된 일정과 기록을 같은 쓰기로 반영한 뒤 선택한 경우에만 시스템 알림을 보낸다. 최근 기록(32건)과 확인 대기열(agenda.pending)을 분리한다. 제때 전달할 회차는 예약 진행, 최근 기록과 같은 쓰기로 대기열 끝에 추가한다. 15분 넘게 늦게 처리한 회차는 기록만 남긴다. 이전 버전의 기록은 다시 표시하지 않는다. 대기열은 표시한 시간이나 최근 기록 수로 줄이지 않는다. 페이지와 팝업은 같은 회차(알람 ID, 예약 시각)만 확인할 수 있으며, 일정 편집은 팝업 전용이다. 초기화 시 일정, 기록과 미확인함은 펫 상태와 함께 삭제된다.

사용자가 Chrome에서 사이트 접근을 제한한 경우 확장은 이를 우회하지 않는다. 펫 메뉴의 사이트 숨김은 렌더링 정책이므로 스크립트 진입까지 막는 권한 철회와는 다르다. 선택적 호스트 권한과 동적 등록은 후속 설계로 남긴다.

### 이미지 접근

페이지의 `<img>`나 CSS에서 확장 내부 파일을 쓰려면 올바른 확장 URL과 `web_accessible_resources`를 확인해야 한다. `public/pets/` 파일은 자동으로 사이트에서 접근 가능하다고 가정하지 않는다. [S6, S7]

```json
{
  "web_accessible_resources": [
    {
      "resources": ["pets/*"],
      "matches": ["http://*/*", "https://*/*"]
    }
  ]
}
```

이는 최종 manifest에서 확인할 예시다. WXT 설정 필드와 산출물은 실제 버전에 맞춰 구성한다. 실제 에셋이 없는 P1에는 불필요한 리소스 선언을 넣지 않아도 된다. 모든 파일을 뜻하는 `resources: ["*"]`는 사용하지 않는다.

에셋 URL은 `browser.runtime.getURL('/pets/...')`처럼 확장 기준으로 만든다. `https://현재사이트/pets/...`로 잘못 요청되지 않는지 빌드 후 검증한다. 실제 파일 이름이 바뀌면 메타데이터와 manifest를 함께 수정한다.

## 4. 공유 상태 계약

영속 상태는 `browserPet.state` 키 하나에 저장한다. 아래는 업그레이드 전 v1의 설계 계약이다. 현재 저장 형식은 이 절 끝의 v4 설명을 따른다.

```ts
export type PetSpeciesId = 'cat-default' | 'dog-default';
export type PetSize = 32 | 64 | 96;
export type MoveSpeed = 'slow' | 'normal';

export interface PetProfile {
  id: string;
  speciesId: string; // 저장 원본. 새 선택 명령은 등록된 PetSpeciesId만 허용한다.
  name: string;
  createdAt: number; // 실제 런타임의 Unix epoch milliseconds
}

export interface PetSettings {
  enabled: boolean;
  sizePx: PetSize;
  speed: MoveSpeed;
  reduceMotion: 'system' | 'always';
  hideWhileFormFocused: boolean;
  hideInFullscreen: boolean;
  hiddenHostnames: string[];
}

export interface MutationReceipt {
  requestId: string;
  fingerprint: string; // 검증/정규화한 명령의 canonical JSON에 대한 SHA-256
  appliedRevision: number;
}

export interface RootStateV1 {
  schemaVersion: 1;
  revision: number;
  pet: PetProfile;
  settings: PetSettings;
  scene?: { anchor: { kind: 'pin' | 'patrol' | 'placed-patrol'; x: number; y: number; at: number; clock?: { elapsed: number; hold?: string } }; pettedAt: number };
  recentRequests: MutationReceipt[]; // 최근 최대 128개
}
```

P7-B에서도 기존 v1 데이터를 이관하거나 새 펫을 만들지 않는다. 등록된 종은 고양이와 강아지이며, 유효하지만 아직 등록되지 않은 ID는 원본을 유지하고 고양이로 표시한다. 종을 선택하면 기존 프로필의 speciesId만 바꾸고 이름, ID, 위치, 행동과 설정은 유지한다.

기본값은 고양이 `cat-default`, 이름 '나비', `enabled: false`, 크기 64, 속도 normal, reduceMotion system, 이전 형식 호환용 입력 및 전체화면 숨김 false, hiddenHostnames 빈 배열이다. ID와 createdAt은 실제 생성 시점에 만든다. 개발자가 고정 UUID나 가짜 생성 시각을 사용자 데이터로 넣지 않는다.

초기 `revision`은 0이다. 한 번의 승인된 변경마다 1 증가한다. 일반적인 전체 초기화에서도 revision을 0으로 되돌리지 않는다. 펫 ID는 새로 생성하고 기존 이름과 설정 및 이전 요청 기록을 제거한다. 현재 초기화 요청의 receipt 하나와 증가한 revision만 남겨 초기화 응답 유실에 대응한다.

scene에는 마지막으로 놓은 위치 또는 산책의 시작 위치(0~1 비율), 기준 시각, 마지막 쓰다듬기 시각을 보관한다. scene이 없는 기존 v1 데이터는 그대로 유지하며 고양이 생성 시각을 산책 기준으로 사용한다. 매 프레임의 좌표, 마우스 경로, 현재 탭 URL, 페이지 제목과 입력값은 저장하지 않는다. 드래그 미리보기는 확장 내부에서만 전달하며 놓았을 때 위치를 저장한다.

### P7-A 저장본 v2

v2의 돌봄 상태는 satiety, mood, xp, lastSettledAt, lastFedAt, lastPetRewardAt으로 구성한다. 이전 v1을 엄격하게 검증한 뒤 같은 펫 ID, 이름, 종, 설정, 장면과 최근 요청 기록을 보존하고 care 필드를 추가한다. 최초 정산 기준은 업그레이드한 시각이다. 미래 형식과 손상된 값은 자동 복구로 덮어쓰지 않는다. 포만감은 시간당 4, 기분은 시간당 2 감소하고 한 공백에는 최대 8시간만 반영한다. 시계가 뒤로 가면 마지막 정산 시각을 사용한다. 정상 v2 조회와 유휴 탭은 저장하지 않는다. 명시적인 돌봄 행동의 정산, 10분/1분의 독립 보상 제한 및 중복 요청 처리는 백그라운드가 직렬로 처리한다.

### 동물별 돌봄 저장본 v3

`care`는 현재 선택한 동물의 단일 기록이다. `restingCare`에는 다른 동물의 기록만 종 ID별로 보관한다. 선택 시 한 번의 저장으로 기록을 교환한다. 처음 선택한 동물만 종별 초기 포만감과 기분에서 시작한다. 기존 v2의 누적 기록을 분해할 수 없으므로 선택된 종의 기록으로 그대로 두고, 다른 동물에 복제하지 않는다. v1은 돌봄만 새로 시작한다. 두 이관 모두 위치, 이름, 설정, revision과 중복 요청 영수증을 보존한다. `CARE_FEED`와 `CARE_PET` 요청에는 화면에서 선택했던 종 ID를 포함해, 전환 직후 다른 동물에게 늦게 보상을 주지 않는다.

### 동물별 이름 저장본 v4

현재 선택한 동물의 이름과 돌봄 기록은 `pet.name`과 `care`에, 나머지 동물은 `restingPets[speciesId] = { name, care }`에 보관한다. 동물을 선택하면 이름과 돌봄을 한 번에 교환하고 공통 위치와 프로필 ID는 유지한다. 이전 버전에 하나만 있었던 이름은 선택된 동물에게 남긴다. v3에서 쉬고 있던 동물의 돌봄 기록은 그대로 옮기고 그 종의 기본 이름을 준다. 이름 저장 시 프로필 ID와 현재 종 ID가 모두 일치해야 한다.

## 5. 변경 메시지 계약

공통 envelope는 `scope: 'browser-pet'`, `protocolVersion: 1`, `type`을 포함한다. 변경 명령에는 `requestId`와 현재 스냅샷의 `expectedPetId`를 추가한다. 초기화로 펫 ID가 바뀌면 이전 펫을 대상으로 보낸 지연 명령은 CONFLICT로 거부한다. UI는 응답 성공 전에 '저장됨'으로 확정 표시하지 않는다.

| type | payload | 허용 송신자 |
| --- | --- | --- |
| `PING` | 없음 | 자체 UI와 Content Script |
| `GET_STATE` | 없음 | 자체 UI와 Content Script |
| `SETTINGS_PATCH` | 허용 설정 필드의 부분 변경 | 팝업/옵션 |
| `PET_RENAME` | speciesId, name | 팝업/옵션 |
| `CARE_FEED`, `CARE_PET` | speciesId (행동 대상) | 팝업, 최상위 Content Script |
| `PET_SELECT_SPECIES` | speciesId (등록된 종) | 팝업/옵션 |
| `SCENE_PIN` | x, y (0~1 비율) | 최상위 Content Script |
| `SCENE_RESUME` | 빈 객체 (저장된 고정 좌표를 그대로 산책 기준점으로 전환) | 최상위 Content Script |
| `SCENE_PET` | 빈 객체 | 최상위 Content Script |
| `SCENE_HIDE` | 빈 객체 | 최상위 Content Script |
| `HOST_HIDE_CURRENT` | 없음 | 최상위 Content Script |
| `HOST_UNHIDE` | hostname | 옵션 |
| `RESET_ALL` | expectedRevision | 옵션, 확인 UI 필수 |

`SETTINGS_PATCH`로 `hiddenHostnames`, `pet`, `schemaVersion`, `recentRequests`, `revision`을 수정할 수 없다. 팝업에서는 enabled만 변경하고 옵션에서 나머지 허용 설정을 변경한다. 호스트 목록은 전용 명령을 사용한다. 범용 `SET_STATE` 명령은 만들지 않는다.

`HOST_HIDE_CURRENT`는 payload의 URL을 신뢰하지 않는다. Background가 Chrome이 제공한 `sender.url`을 파싱해 HTTP/HTTPS인지 확인하고 hostname만 추출한다. `sender.id`가 자기 확장 ID인지 확인하고 `sender.frameId === 0`과 탭 문맥을 검증한다. 전체 URL을 저장하거나 로그에 남기지 않는다.

팝업/옵션은 `sender.url`의 프로토콜, 호스트의 확장 ID, 실제 빌드의 허용 경로를 검사한다. 웹페이지나 임의의 확장 페이지가 옵션 전용 초기화 명령을 호출할 수 있도록 느슨하게 허용하지 않는다.

hostname은 소문자 정규화와 중복 제거를 적용하고 URL 파서를 활용해 유효성을 검증한다. 포트와 경로는 저장하지 않는다. 최대 200개를 허용하며 상한에서 명확한 오류를 반환한다. 이름은 제품 문서의 길이와 제어문자 규칙을 검증한다.

응답은 JSON 직렬화 가능한 tagged union으로 만든다. DOM 객체, Error 인스턴스, 함수, Map, Date 객체를 직접 보내지 않는다. [S8]

```ts
type Reply =
  | { ok: true; state: RootStateV1; alreadyApplied?: boolean;
      appliedRevision?: number }
  | { ok: false; code: string; message: string };
```

PING만 별도의 `{ ok: true, type: 'PONG' }` 응답을 사용한다. 오류 코드는 `INVALID_MESSAGE`, `FORBIDDEN`, `VALIDATION_ERROR`, `CONFLICT`, `REQUEST_ID_REUSED`, `STORAGE_ERROR`, `STORAGE_CORRUPT`, `UNSUPPORTED_SCHEMA` 등으로 명시한다. 예상하지 않은 스택이나 민감한 sender 정보를 UI에 반환하지 않는다.

## 6. 단일 쓰기 경로와 충돌 방지

Chrome Storage의 변경 이벤트는 동기화 신호이지 트랜잭션이나 충돌 방지 기능이 아니다. 두 탭에서 전체 상태를 각각 읽어 수정하고 덮어쓰면 한쪽 변경이 유실될 수 있다. 따라서 다음 절차를 강제한다. [S3]

1. Content Script, 팝업, 옵션은 명령만 보낸다. 직접 `storage.local.set/remove/clear`를 호출하지 않는다.
2. Background 리스너는 시작 시 동기적으로 등록하고, 비동기 처리는 내부 큐로 보낸다.
3. 큐 안에서 최신 루트 상태를 저장소에서 읽고 스키마를 검증한다.
4. requestId가 기록되어 있으면 명령을 다시 적용하지 않는다. 같은 ID에 다른 fingerprint면 거부한다. fingerprint는 명령 원문이 아니라 canonical JSON의 SHA-256이며 로그에 남기지 않는다.
5. 중복 확인 후 expectedPetId를 현재 펫 ID와 비교한다. 일치하면 현재 상태에 검증된 부분 변경만 적용하고 revision과 요청 기록을 함께 갱신한다.
6. 루트 객체 하나를 저장한 뒤에만 성공 응답을 보낸다.
7. 큐의 한 작업이 실패해도 후속 요청은 실행되도록 오류를 분리한다.

`onInstalled`, 최초 생성, 마이그레이션, 초기화도 같은 큐를 사용한다. 각 탭이 기본 상태를 따로 저장하는 경쟁을 만들지 않는다. 단일 writer는 이 코드베이스의 설계 규칙이며 Chrome Storage의 API 접근 권한을 읽기 전용으로 바꾼 것은 아니다.

호환성 있는 메시지 응답을 위해 동기 `onMessage` 리스너에서 비동기 작업을 시작하고 명시적으로 `return true`를 반환한 뒤 `sendResponse`로 종료하는 방식을 기본으로 한다. 무분별하게 여러 `async` 리스너를 등록하지 않는다. Promise 응답 지원에 대한 버전 가정을 만들지 않는다. [S8]

서비스 워커가 재시작되면 메모리 큐도 새로 만들어진다. 이미 저장한 결과와 requestId는 루트 객체에 남으므로, 저장 직후 응답이 유실되어 재전송돼도 최근 명령의 중복 적용을 막는다. 이는 최근 128개 범위의 중복 방지이며 무제한 exactly-once 보장이 아니다. 저장 API에 다중 키 트랜잭션이나 CAS가 있는 것처럼 설명하지 않는다.

전송 오류가 발생하면 동일 requestId로 최대 한 번 재시도할 수 있다. 사용자가 연속 클릭하는 동안 같은 입력 버튼은 pending 상태로 둔다. 오래된 요청을 자동으로 계속 재전송하지 않는다. `RESET_ALL`은 expectedRevision을 검사해 그 사이 다른 변경이 생겼으면 다시 확인을 요구한다.

## 7. 읽기와 UI 동기화

Content Script와 자체 UI는 해당 키의 `storage.onChanged`를 구독할 수 있다. 마운트 시 먼저 구독을 설정하고 GET_STATE로 초기 스냅샷을 가져온다. `areaName === 'local'`과 정확한 키만 처리한다. 동일 스키마에서 더 낮은 revision의 늦은 응답은 무시한다.

이벤트 값과 초기 응답을 모두 런타임 검증한다. 파싱 실패 시 펫을 안전하게 숨기고 팝업에 오류를 표시한다. 동작 중이던 잘못된 상태를 그대로 쓰지 않는다. 이름 또는 설정이 바뀌었을 때만 관련 React UI를 갱신한다.

보이지 않던 탭이 다시 보일 때는 최신 상태를 한 번 확인할 수 있다. 매초 폴링, 프레임별 메시지, 워커를 살려 두기 위한 heartbeat는 금지한다. popup close가 펫을 멈추게 해서는 안 된다.

## 8. 초기화, 오류와 업데이트

- 상태가 전혀 없을 때만 기본 데이터를 생성한다. 브라우저 시작이나 확장 업데이트마다 초기화하지 않는다.
- 업데이트에서는 schemaVersion에 따른 명시적인 변환만 수행한다. P0~P6는 v1을 유지한다.
- 알 수 없는 미래 스키마는 덮어쓰지 않고 `UNSUPPORTED_SCHEMA`로 안전 중지한다.
- 손상된 데이터는 자동 삭제하지 않는다. 원본을 보존하고 오류 및 사용자가 선택할 초기화 절차를 표시한다.
- 손상 상태 초기화는 옵션에서 별도 확인한 경우에만 수행한다. 손상 상태 복구는 일반 변경과 구별된 확인된 RESET_ALL 요청으로만 처리하며, 유효한 펫 ID/revision을 읽을 수 없을 때만 해당 expected 값의 null을 허용한다. 읽을 수 있는 revision은 이어받고, 없으면 복구용 새 상태를 만든다. 구독 클라이언트는 손상 오류 때 기존 스냅샷을 폐기하고 초기화 후 다시 GET_STATE 한다.
- 저장 실패 시 이전 상태를 유지하고 오류를 보여 준다. 실패를 숨기고 성공 효과를 계속 보여 주지 않는다.
- 확장 삭제 시 로컬 데이터가 제거될 수 있음을 안내한다. MVP는 백업과 계정 복구를 제공하지 않는다. [S3]

## 9. Content Script 생명주기

표시 컨트롤러와 렌더러를 분리한다. 전체 끄기 또는 비활성 창/탭일 때 렌더러는 제거하지만, 설정 변경을 받는 가벼운 구독은 유지한다. 다시 켜졌을 때 렌더러를 재생성할 수 있어야 한다.

문서당 확장 소유 host 하나만 만든다. 재실행과 HMR에서 이전 인스턴스를 정리하고 중복 생성하지 않는다. 확장 고유 ID와 소유 표시를 확인하며 이름이 비슷한 페이지 요소를 임의 삭제하지 않는다.

정리 대상은 React root, rAF, 타이머, Pointer capture, DOM 이벤트, storage 구독, observer다. WXT의 content-script context 및 invalidation 지원을 사용하고 수동으로 추가한 리소스도 해제한다. 확장 업데이트나 비활성화만으로 이미 삽입된 DOM과 코드가 항상 즉시 제거된다고 가정하지 않는다. 정리할 수 없는 기존 문서는 새로고침 안내로 복구한다. [S1]

`pagehide`에서 렌더러를 정리하고 bfcache 복원 `pageshow`에서 중복 없이 복원한다. 일반 SPA 라우트 변경은 같은 문서로 취급한다. DOM 전체를 관찰하는 비싼 MutationObserver는 쓰지 않는다. host가 제거되는 특수 사이트는 제한적인 재마운트 또는 안전 중지를 사용하고, 무한 재삽입 경쟁은 피한다.

## 10. 보안과 개인정보 경계

실제 사용자 이름과 숨김 hostname은 로컬 장치에만 남긴다. 프로덕션 코드에는 외부 fetch, WebSocket, analytics, 오류 수집 SDK가 없다. 개발 모드의 HMR 요청 및 사용자가 보는 원래 웹페이지의 네트워크 요청과 확장의 전송은 구분한다.

원격 실행 JavaScript/WASM을 로드하지 않는다. 스프라이트와 UI 리소스도 로컬에 묶는다. 콘텐츠를 HTML 문자열로 삽입하지 않는다. Shadow DOM의 열린/닫힌 모드를 데이터 보안 장치로 믿지 않는다. [S9]

설정과 기능은 실제 구현에 맞춰 개인정보 안내에 반영한다. '사이트 접근 권한이 없다', '어떤 정보도 저장하지 않는다' 같은 부정확한 표현을 쓰지 않는다.

공식 출처 ID는 `05_TESTING_AND_RELEASE.md`에 정의되어 있다.
