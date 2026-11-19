# 05. 테스트, 품질, 출시와 공식 출처

## 1. 검증 원칙

타입 검사와 빌드 성공만으로 확장 프로그램의 실제 동작을 보장할 수 없다. 모의 API 단위 테스트, 실제 확장을 로드한 자동 테스트, 일반 Chrome 수동 검증을 나눠 기록한다.

테스트를 실행할 수 없는 환경에서는 이유와 사용자가 실행할 절차를 적는다. 검증 결과를 가정하거나 스크린샷을 만들어 낸다거나, 사용자 확인을 대신했다고 쓰지 않는다. 현재 문서 패키지는 소스와 실행 결과를 포함하지 않는다.

## 2. 테스트 도구와 실행 기준

| 도구 | 검증 대상 | 유의점 |
| --- | --- | --- |
| TypeScript | 타입 계약과 잘못된 호출 | 런타임 데이터 검증을 대체하지 않음 |
| ESLint | 코드 오류, 효과와 cleanup, 계층 경계 | generated 파일 제외 |
| Vitest | core, 메시지, 저장 reducer/queue | fake clock과 RNG 사용 |
| React Testing Library | 팝업, 메뉴, 옵션의 사용자 조작 | 움직임을 React로 매 프레임 갱신하지 않음 |
| Playwright Chromium | 실제 확장의 content/popup/storage 동작 | persistent context 사용 |
| 일반 Chrome | 호환성, 사이트별 영향, 워커 수명, 성능 | 프로덕션 빌드와 실제 버전 기록 |

WXT는 Vitest 연동과 메모리 기반 확장 API 테스트 도구를 제공한다. 이 구현은 실제 Chrome의 권한 처리나 워커 수명과 동일하다고 간주하지 않는다. [S12]

Playwright의 확장 테스트는 번들 Chromium의 persistent context를 사용한다. 현재 공식 문서는 일반 Chrome/Edge의 명령줄 확장 로드 제약을 안내하므로, `channel: 'chrome'`에 과거 플래그만 붙이는 설정을 기본으로 쓰지 않는다. 자동 테스트 프로필과 실제 사용자 프로필을 섞지 않는다. [S13]

## 3. npm 스크립트

P0에서 아래 계약을 구현한다. 프로젝트가 아직 없는 상태에서 이 명령을 실행했다가 실패한 것을 제품 결함으로 기록하지 않는다.

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run check
```

P2 이후에는 다음 명령을 추가한다.

```bash
npm run test:e2e
```

E2E 실행 전에 필요한 production 빌드와 fixture 서버 준비를 스크립트/설정에 명시한다. 같은 명령을 다시 실행했을 때 이전 프로필과 데이터가 결과를 오염시키지 않도록 매 테스트의 프로필 생성/정리를 관리한다. 업데이트 검증은 의도적으로 같은 프로필을 유지하는 별도 테스트다.

P6에서 `npm run zip`을 실행하고 실제 출력 경로를 기록한다. `.output/`, `.wxt/`, `node_modules/`, 테스트 결과, 개인 프로필은 소스 Git에 포함하지 않는다. lockfile과 소스 테스트는 포함한다.

## 4. 필수 단위/통합 테스트

| ID | 시나리오 | 기대 결과 | 최초 단계 |
| --- | --- | --- | --- |
| T-01 | 잘못된 scope/protocol/type | 명령 거부, 상태 변경 없음 | P0/P1 |
| T-02 | 저장 키 없음, 두 요청 동시에 시작 | 기본 펫 하나만 생성 | P1 |
| T-03 | enabled false→true→false | 마운트/제거가 정확히 한 번씩 | P1 |
| T-04 | 같은 문서 중복 초기화 | host와 listener 중복 없음 | P1 |
| T-05 | 서로 다른 dt로 같은 시간 이동 | 허용 오차 내 같은 거리 | P2 |
| T-06 | 화면 경계와 극소 뷰포트 | 좌표 유효, 반전 진동 없음 | P2 |
| T-07 | 숨김 후 장시간 뒤 복귀 | 현재 공유 위치와 행동으로 렌더링 재개 | P2 |
| T-08 | 고정 RNG의 상태 전이 | 예상 행동과 지속 시간 | P2 |
| T-09 | drag 임계값 전후 | 클릭과 drag가 중복 실행 안 됨 | P3 |
| T-10 | pointercancel/lost capture | 드래그 해제, 취소된 위치를 새 고정 위치로 확정하지 않음 | P3 |
| T-11 | 메뉴 열림/닫힘, 다른 pause 이유 존재 | 자동 이동 잘못 재개하지 않음 | P3/P5 |
| T-12 | UI 밖 클릭 | 원래 페이지 동작 유지 | P3 |
| T-13 | A탭 이름 변경 + B탭 설정 변경 | 두 변경 모두 보존 | P4 |
| T-14 | 같은 필드의 순차 변경 | Background 승인 순서대로 반영 | P4 |
| T-15 | 저장 후 응답 유실 및 동일 ID 재전송 | 중복 적용 없음 | P4 |
| T-16 | 같은 requestId, 다른 명령 내용 | REQUEST_ID_REUSED | P4 |
| T-17 | 큐 안의 저장 실패 후 다음 요청 | 다음 정상 요청 처리 가능 | P4 |
| T-18 | 늦게 도착한 초기 스냅샷 | 최신 revision을 덮어쓰지 않음 | P4 |
| T-19 | 위조 sender와 옵션 전용 명령 | FORBIDDEN, 저장 변경 없음 | P4 |
| T-20 | 잘못된 이름, 설정, hostname | 검증 오류, 이전 값 보존 | P4/P5 |
| T-21 | schemaVersion 미래 값 | 자동 덮어쓰기 없음 | P4 |
| T-22 | 손상 데이터 | 안전 중지, 승인 전 삭제 없음 | P4 |
| T-23 | reset 중 동시 변경, 초기화 전 펫의 지연 요청 | revision/expectedPetId 충돌 처리, 이전 상태 부활 방지 | P4 |
| T-24 | 폼 포커스/전체화면/hidden 조합 | 활성 탭에서는 전체 버튼을 따르고 숨겨진 탭에는 미표시 | P5 |
| T-25 | 이전 프로필의 숨긴 hostname | 켜면 기존 목록과 관계없이 표시 | P5 |
| T-26 | reduce motion | 자동 이동/반복 효과 없음 | P5 |
| T-27 | context cleanup 두 번 호출 | 오류 없이 모든 리소스 해제 | P5 |
| T-28 | 프레임 인덱스와 이미지 경계 | 빈 프레임/잘못된 URL 없음 | P2/P6 |

동시성 테스트는 단순히 최종 객체를 직접 만들어 비교하지 않는다. 서로 다른 명령을 처리 경로로 보내 읽기/쓰기 타이밍을 제어하고 변경 유실 여부를 확인한다. worker 메모리를 새로 만드는 테스트에서도 영속 저장소는 유지한다.

## 5. E2E fixture

개인 계정이나 실제 민감한 입력을 쓰지 않고 로컬 테스트 사이트를 만든다.

| fixture | 내용 |
| --- | --- |
| basic | 링크, 버튼, 스크롤 가능한 긴 본문 |
| hostile-css | 전역 button/img 규칙, 특이한 root font-size |
| forms | input, textarea, contenteditable, 테스트용 더미 입력 |
| frames | iframe이 있는 최상위 문서 |
| spa | 새 문서 로드 없는 화면 전환 |
| layers | fixed header, modal dialog, fullscreen 가능한 요소 |
| small | 작은 뷰포트와 큰 확대율 |

두 개의 독립 origin/hostname에서 전체 스위치 하나로 표시가 바뀌는지 검증한다. 포트만 다른 localhost는 같은 hostname으로 취급되므로 두 hostname을 흉내 낸 것으로 계산하지 않는다. 테스트 환경에서 안전한 로컬 호스트 매핑이나 네트워크 라우팅 fixture를 사용한다.

필수 자동 경로는 확장 로드 → 팝업에서 시작 → fixture에 펫 표시 → 클릭/drag → 두 탭 설정 공유 → 숨김/재표시 → 페이지 재로드 후 복원이다. 실제 visibility 전환은 브라우저가 보고하는 상태를 확인한다. DOM 속성을 임의 변조한 단위 테스트만으로 실제 숨김 탭 동작을 검증했다고 하지 않는다.

팝업 HTML을 일반 탭으로 열어 React 동작을 검증하는 것과 툴바 action 팝업이 실제로 열리고 닫히는 검증은 구별한다. 후자는 일반 Chrome 수동 점검에 포함한다.

## 6. 실제 Chrome 수동 테스트

프로덕션 빌드를 로드하고 OS, Chrome 버전, 확장 버전, 화면 크기/배율, 테스트 날짜를 기록한다. 일반 사이트에는 사용자 개인 데이터가 있을 수 있으므로 화면과 로그를 공유할 때 민감 정보를 제거한다.

| 검증 화면 | 필수 확인 |
| --- | --- |
| Google 검색 | 페이지 클릭, 스크롤, 검색 입력 중에도 표시 |
| Naver 일반 페이지 | 스타일 충돌과 고정 UI 간섭 |
| YouTube 일반/영상 페이지 | 재생 컨트롤, SPA 이동, 전체화면 중에도 전체 버튼을 따름 |
| Wikipedia 또는 긴 문서 | 스크롤과 읽기 방해 |
| 로컬 form fixture | 입력값을 읽지 않고 포커스만으로 동작 |
| Chrome 내부 설정/웹 스토어 | 표시되지 않는 예상 제한 |
| 내장 PDF 뷰어/새 탭 | 미지원 안내와 오류 폭주 없음 |

### 핵심 시나리오

설치 직후 기존 탭 새로고침, 팝업을 닫은 채 산책, 빠른 탭 전환, 페이지 새로고침, SPA 이동, 뒤로/앞으로 가기, 창 크기 변경, 페이지 확대, 드래그 도중 전체 표시 끄기를 확인한다. 드래그를 마쳤을 때는 스크롤과 탭 전환 후에도 화면 내 상대 위치가 유지되는지, ‘산책 다시 시작’을 누르면 고정이 풀리는지 확인한다.

같은 프로필의 일반 창을 두 모니터에 나란히 놓고 번갈아 선택한다. 현재 창에만 펫이 한 마리 있고, 앞서 고정한 위치와 설정이 이어져야 한다. 별도 로그인이나 결제 팝업에 포커스가 있는 동안에는 뒤의 일반 창과 팝업 양쪽 모두 펫이 없어야 한다. 팝업을 닫고 돌아올 때 전체 버튼이 켜져 있으면 재표시한다. 작은 크기로 줄인 일반 창은 팝업과 구분한다.

확장 새로고침과 브라우저 재시작 후 이름, 설정과 고정 위치가 유지되는지 확인한다. 워커 종료/재시작 검증은 확장 전체 새로고침과 구별한다. 현재 Chrome에서 지원하는 테스트 방법으로 워커를 중지하거나 유휴 종료 후 명령을 보내고, 사용한 방법을 기록한다. 수명 확인 중에는 검사 도구가 실행 상태에 영향을 줄 수 있음을 고려해 실제 사용자 상태에서도 확인한다.

## 7. 성능과 누수 목표

다음 수치는 이 프로젝트의 개발 목표이며 측정한 결과나 기기 전체의 보장이 아니다. 초기 단계에서는 기능 정확성을 먼저 확인하되 공개 전에는 반드시 측정한다.

| 항목 | 목표와 검증 방법 |
| --- | --- |
| 위치 루프 | 표시 인스턴스당 최대 1개 |
| 숨김 문서 | 펫 rAF와 행동 타이머 0, CSS 애니메이션 일시정지 |
| 평상시 저장 | 이름/설정 변경이 없으면 쓰기 0 |
| 네트워크 | 프로덕션 확장 런타임의 외부 전송 0 |
| React 갱신 | x/y 이동 때문에 매 프레임 전체 UI 재렌더하지 않음 |
| 레이아웃 | 매 프레임 DOM 크기 읽기/강제 reflow를 반복하지 않음 |
| 장시간 사용 | 30분 사용 중 중복 펫, 기능 고착, 오류 폭주 없음 |
| 반복 이동 | 문서 이동/뒤로 가기/새로고침 30회 후 host 수와 listener 수 증가 없음 |
| 10개 탭 | hidden 탭의 애니메이션 루프가 계속 실행되지 않음 |
| 메인 스레드 | 60초 프로파일에서 확장 동작에 의한 지속적인 긴 작업을 조사하고 제거 |

Chrome DevTools Performance/Memory와 Chrome 작업 관리자로 확장 활성 전후를 비교한다. CPU 비율과 메모리는 OS, 사이트, 기기에 따라 달라지므로 '무조건 1% 이하' 같은 수치를 보장하지 않는다. 반복 테스트에서 누적 증가하는지와 실제 사용 방해를 우선 판단한다.

고정 사이트 fixture와 동일 조건에서 측정하고 테스트 환경, 관찰, 개선 전후를 기록한다. 애니메이션을 꺼 놓고 측정한 수치를 실제 산책 성능이라고 보고하지 않는다.

## 8. 프로덕션 배포 전 확인

### 코드와 권한

생성된 manifest가 MV3인지, API 권한이 실제 기능과 일치하는지, Content Script 범위가 설명과 같은지 확인한다. 모든 `resources`를 노출하는 설정, 불필요한 host_permissions, 개발 전용 URL과 권한을 제거한다.

외부 JavaScript/WASM 실행, CDN 실행 코드, eval/new Function 기반 우회, 원격 분석을 넣지 않는다. 설치한 라이브러리가 빌드 결과에 외부 실행 코드 로더를 포함하는지도 확인한다. [S9]

확장 자체의 단일 목적을 '웹페이지 위의 반려동물 표시와 상호작용'으로 유지한다. unrelated 검색 변경, 광고 삽입, 추천 쇼핑, 방문 기록 수집을 추가하지 않는다. 지속 UI는 웹서핑을 방해하지 않도록 점검한다. [S17]

### 데이터 안내 초안

아래는 현재 설계를 설명하는 제품 문구이며 정식 법률 검토나 스토어 승인을 의미하지 않는다. 실제 구현과 제출 시점의 정책에 맞춰 다시 확인한다.

> Browser Pet은 펫의 이름과 표시 설정, 돌봄 정보를 기기의 Chrome 확장 저장소에 저장합니다. 이전 버전의 숨긴 사이트 목록은 이미 기기에 남아 있을 수 있습니다. 현재 버전은 페이지 본문, 입력값, 방문 기록을 수집하거나 외부 서버로 보내지 않습니다. 웹페이지에 펫을 표시하기 위해 사이트 접근 권한이 필요합니다. 확장을 삭제하면 로컬 데이터가 제거될 수 있으며, 계정 기반 백업이나 기기 간 동기화는 제공하지 않습니다.

로컬 저장도 저장이라는 사실을 숨기지 않는다. 사용자가 직접 입력한 이름이나 숨김 hostname을 console 또는 오류 추적 시스템으로 전송하지 않는다. 나중에 서버/분석을 추가하면 안내와 권한을 함께 재검토한다.

### 에셋과 스토어 자료

최종 고양이와 아이콘의 실제 파일, 라이선스/계약, 출처 표기, 번들 배포와 저장소 공개 허용 여부를 확인한다. 미선정 에셋과 placeholder는 출시 차단 사유다. 사용자가 승인한 자체 제작 최종 에셋으로 대체할 수 있다.

아이콘, 스토어 스크린샷, 설명, 지원 연락 수단과 필요한 개인정보 안내를 준비한다. 이미지 규격, 등록 비용, 개발자 인증 및 대시보드 필수 항목은 제출 시점의 공식 안내로 확인하며 이 문서에 고정된 최신값처럼 적지 않는다.

### 패키지

깨끗한 설치가 가능한지 검증한 다음 production build와 zip을 만든다. ZIP 안의 manifest 위치, 코드, 이미지가 정상인지 점검한다. 문서 ZIP, 개발 소스 전체 ZIP, 실제 확장 배포 ZIP을 구분한다.

첫 공개 전에 버전과 알려진 제한을 기록한다. 확장 업데이트 시 기존 데이터 보존을 재검증한다. 사용자의 승인 없이 스토어로 업로드하지 않는다.

## 9. 오류 심각도와 중단 기준

| 수준 | 예시 | 대응 |
| --- | --- | --- |
| 치명적 | 페이지 클릭 차단, 입력 가로채기, 데이터 유실, 외부 전송 | 다음 단계와 배포 중단, 우선 수정 |
| 높음 | 숨김 탭 CPU 사용, 펫 중복, 저장 충돌, drag 고착 | 공개 전 반드시 수정 |
| 보통 | 특수 사이트 레이어 문제, 메뉴 위치 일부 오차 | 회피 가능성 평가, 제한 기록, 사용자 검증 |
| 낮음 | 시각 미세 조정, 덜 자연스러운 애니메이션 | 핵심 품질 후 개선 |

지원 대상 사이트에서 반복 발생하는 문제를 '특수 사이트'라는 이유로 무조건 제외하지 않는다. 재현과 영향도를 기록하고 해결 또는 범위 제한을 명확히 설명한다.

## 10. 공식 기술 출처

이 문서는 아래 공식 자료를 바탕으로 기술 경계를 설정했다. 라이브러리 API와 스토어 정책은 바뀔 수 있으므로 구현/제출 시 다시 확인한다. 제품 기본값, 상태 이름, 단계 구분, 성능 목표는 프로젝트 설계이며 출처가 정한 규칙이 아니다.

| ID | 공식 문서 | 확인할 내용 |
| --- | --- | --- |
| S1 | [WXT Content Scripts](https://wxt.dev/guide/essentials/content-scripts) | Shadow UI, cssInjectionMode, context cleanup |
| S2 | [Chrome Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) | 실행 세계, 매칭, 프레임, 실행 시점 |
| S3 | [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) | local, onChanged, 비동기 저장, 삭제 시 데이터 |
| S4 | [Chrome Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) | 유휴 종료, 메모리 손실, 영속 상태 |
| S5 | [Chrome Declare Permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) | matches와 host 권한, 경고, 선택 권한 |
| S6 | [WXT Assets](https://wxt.dev/guide/essentials/assets) | public 리소스, Content Script의 확장 URL |
| S7 | [Chrome Web Accessible Resources](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources) | 웹페이지에서 접근 가능한 리소스 범위 |
| S8 | [Chrome Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) | 요청/응답, JSON 직렬화, return true 호환 방식 |
| S9 | [Chrome Remote Hosted Code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code) | 원격 실행 코드 제한과 번들 검사 |
| S10 | [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) | timestamp, 화면 갱신, 프레임 독립 이동 |
| S11 | [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) | hidden 상태와 visibilitychange |
| S12 | [WXT Unit Testing](https://wxt.dev/guide/essentials/unit-testing) | Vitest 연동과 API 모의 구현 |
| S13 | [Playwright Chrome Extensions](https://playwright.dev/docs/chrome-extensions) | persistent Chromium context, 확장 로딩 |
| S14 | [WXT Installation](https://wxt.dev/guide/installation) | 공식 React 템플릿과 npm 시작 |
| S15 | [OpenAI: Iterating Development Workflows with Codex](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex) | AGENTS.md, 단계 범위와 검증 기록 |
| S16 | [WXT Extension APIs](https://wxt.dev/guide/essentials/extension-apis) | browser import와 API 사용 |
| S17 | [Chrome Web Store Quality Guidelines](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines) | 단일 목적, 사용 경험을 방해하지 않는 UI |
| S18 | [WXT FAQ](https://wxt.dev/guide/resources/faq) | Shadow Root의 portal과 rem 관련 주의 |

AGENTS.md는 Codex가 읽을 프로젝트 지침으로 사용하고, 다른 Markdown 파일은 이 프로젝트가 선택한 작업 방식이다. 파일 이름이 있다는 이유만으로 모든 도구가 자동으로 상세 문서를 읽는다고 가정하지 않는다. 시작 프롬프트에서 필요한 문서를 명시한다. [S15]
