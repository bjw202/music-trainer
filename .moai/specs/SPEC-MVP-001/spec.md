---
id: SPEC-MVP-001
version: "1.1.0"
status: approved
created: "2026-02-13"
updated: "2026-02-16"
author: jw
priority: critical
---

## HISTORY

| Version | Date       | Author | Description                    |
|---------|------------|--------|-------------------------------|
| 1.0.0   | 2026-02-13 | jw     | Phase 1 MVP SPEC 초안 작성    |
| 1.1.0   | 2026-02-16 | jw     | ED-012 단축키 A→Q 변경, UI 리디자인 반영 |

---

# SPEC-MVP-001: Music Trainer Phase 1 MVP

## 개요

웹 기반 오디오 플레이어의 핵심 기능을 구현하여 사용자가 음악 파일을 로드하고, 파형을 시각화하며, A-B 루프를 활용한 효과적인 연습 환경을 제공합니다.

**개발 방법론**: Hybrid (TDD for new features + DDD for audio integration)

---

## 1. Ubiquitous Requirements (항상 활성화)

### UR-001: 오디오 형식 지원
시스템은 **항상** MP3, WAV, M4A, OGG 형식의 오디오 파일을 로드할 수 있어야 한다.

### UR-002: 재생 상태 정확성
시스템은 **항상** 재생 상태(playing/paused/stopped)를 정확히 유지해야 한다.

### UR-003: 시간 표시 정확성
시스템은 **항상** 현재 재생 시간과 전체 길이를 mm:ss 형식으로 표시해야 한다.

### UR-004: 볼륨 제어 범위
시스템은 **항상** 0%~100% 범위의 마스터 볼륨을 제공해야 한다.

### UR-005: 파형 렌더링 성능
시스템은 **항상** 60fps로 부드러운 파형을 렌더링해야 한다.

---

## 2. Event-Driven Requirements (이벤트 발생 시)

### ED-001: 파일 드래그 앤 드롭
**WHEN** 사용자가 오디오 파일을 드래그 앤 드롭하면
**THEN** 시스템은 파일을 검증하고 AudioBuffer로 로드한다.

### ED-002: Play 버튼 클릭
**WHEN** 사용자가 Play 버튼을 클릭하면
**THEN** 시스템은 현재 위치부터 오디오를 재생하고 playing 상태로 전환한다.

### ED-003: Pause 버튼 클릭
**WHEN** 사용자가 Pause 버튼을 클릭하면
**THEN** 시스템은 현재 위치를 유지하며 재생을 일시정지하고 paused 상태로 전환한다.

### ED-004: 파형 Seek 클릭
**WHEN** 사용자가 파형의 특정 위치를 클릭하면
**THEN** 시스템은 해당 시간 위치로 재생 위치를 변경한다.

### ED-005: A 지점 설정
**WHEN** 사용자가 'I' 키를 누르거나 A 버튼을 클릭하면
**THEN** 시스템은 현재 재생 위치를 A 지점으로 설정하고 파형에 시각적으로 표시한다.

### ED-006: B 지점 설정
**WHEN** 사용자가 'O' 키를 누르거나 B 버튼을 클릭하면
**THEN** 시스템은 현재 재생 위치를 B 지점으로 설정하고 파형에 루프 영역을 강조 표시한다.

### ED-007: 루프 재생
**WHEN** 재생 위치가 B 지점에 도달하고 루프가 활성화되어 있으면
**THEN** 시스템은 재생 위치를 A 지점으로 즉시 이동하고 재생을 계속한다.

### ED-008: 볼륨 슬라이더 드래그
**WHEN** 사용자가 볼륨 슬라이더를 드래그하면
**THEN** 시스템은 실시간으로 마스터 볼륨을 조정하고 백분율을 표시한다.

### ED-009: 뮤트 토글
**WHEN** 사용자가 'M' 키를 누르거나 Mute 버튼을 클릭하면
**THEN** 시스템은 이전 볼륨 값을 저장하고 볼륨을 0%로 설정한다 (언뮤트 시 복원).

### ED-010: Space 키 단축키
**WHEN** 사용자가 Space 키를 누르면
**THEN** 시스템은 현재 playing이면 pause, paused이면 play로 전환한다.

### ED-011: Arrow 키 단축키
**WHEN** 사용자가 Arrow Left/Right 키를 누르면
**THEN** 시스템은 현재 위치에서 -5초/+5초 이동한다.

### ED-012: Q 키 단축키 (루프 A 지점 이동)
**WHEN** A-B 루프가 활성화된 상태에서 사용자가 'Q' 키를 누르면
**THEN** 시스템은 재생 위치를 A 지점으로 즉시 이동한다.
**AND** 현재 재생 상태(playing/paused)를 유지한다.

**WHEN** A-B 루프가 비활성화된 상태에서 사용자가 'Q' 키를 누르면
**THEN** 시스템은 아무 동작도 하지 않는다.

---

## 3. State-Driven Requirements (상태 조건부)

### SD-001: Play 버튼 가시성
**IF** 재생 상태가 paused 또는 stopped이면
**THEN** 시스템은 Play 버튼을 활성화하고 Pause 버튼을 비활성화한다.

### SD-002: Pause 버튼 가시성
**IF** 재생 상태가 playing이면
**THEN** 시스템은 Pause 버튼을 활성화하고 Play 버튼을 비활성화한다.

### SD-003: 파형 인터랙션
**IF** 오디오 파일이 로드되어 있으면
**THEN** 시스템은 파형 클릭 및 드래그를 활성화한다.

### SD-004: 루프 영역 표시
**IF** A 지점과 B 지점이 모두 설정되어 있으면
**THEN** 시스템은 A-B 구간을 파형에 반투명 색상으로 강조 표시한다.

### SD-005: Stop 버튼 동작
**IF** 재생 상태가 playing 또는 paused이면
**THEN** 시스템은 Stop 버튼을 활성화한다.

---

## 4. Unwanted Requirements (금지 사항)

### UN-001: 동기 오디오 로딩 금지
시스템은 메인 스레드를 블로킹하는 동기 방식으로 오디오를 로드하지 않아야 한다.

### UN-002: DOM 직접 조작 금지
React 컴포넌트는 React 외부에서 DOM을 직접 조작하지 않아야 한다 (Canvas 렌더링 제외).

### UN-003: AudioBuffer 메모리 누수 금지
시스템은 오디오 파일 언로드 시 AudioBuffer를 메모리에서 반드시 해제해야 한다.

### UN-004: 평문 인증 정보 금지
시스템은 API 키나 인증 토큰을 클라이언트 코드에 평문으로 포함하지 않아야 한다.

### UN-005: 기능 간 상태 간섭 금지
각 기능(Volume, Seek, Loop, Keyboard Shortcuts)은 다른 기능의 상태를 변경하지 않아야 한다.
- Seek 시 GainNode를 재설정하지 않아야 한다.
- Volume 변경 시 Loop 이벤트 리스너를 제거하지 않아야 한다.
- Keyboard Seek 시 Loop 범위 검증을 우회하지 않아야 한다.
- Mute 상태는 Seek, Loop 등 다른 기능 사용 후에도 유지되어야 한다.

---

## 5. Optional Requirements (선택 사항)

### OP-001: YouTube URL 로딩
**가능하면** 시스템은 YouTube URL을 입력받아 오디오를 추출할 수 있다. (Low priority)

### OP-002: 파일 정보 표시
**가능하면** 시스템은 파일명, 비트레이트, 샘플레이트를 표시한다. (Medium priority)

### OP-003: 최근 파일 목록
**가능하면** 시스템은 최근 로드한 파일 5개를 표시하여 빠른 재로드를 지원한다. (Low priority)

---

## 6. 기술 스택

### 프론트엔드 코어
- React 19.0.0
- TypeScript 5.7.x
- Vite 6.0.x
- Node.js 20 LTS

### 상태 관리
- Zustand 5.0.x

### 스타일링
- Tailwind CSS 4.0.x

### 오디오 처리
- Web Audio API (브라우저 네이티브)
- wavesurfer.js 7.8.x

### 테스트
- Vitest 2.1.x
- Playwright 1.48.x
- React Testing Library 16.x

### 패키지 관리
- pnpm 9.x

---

## 7. 오디오 신호 체인 (Phase 1)

```
File Source (File/Blob)
    |
[AudioBuffer Load]
    |
BufferSource
    |
GainNode (master volume, 0.0~1.0)
    |
AnalyserNode (waveform data extraction)
    |
Destination (speakers/headphones)
```

---

## 8. UI 디자인 (Pencil MCP)

### 디자인 시스템
- **Dark Theme**: Logic Pro 스타일
  - Background Primary: `#1a1a1a`
  - Background Secondary: `#2a2a2a`
  - Text Primary: `#e0e0e0`
  - Text Secondary: `#a0a0a0`
  - Accent Blue: `#007aff`
  - Accent Red: `#ff3b30`
  - Accent Green: `#34c759`

### Pencil 산출물
1. **player-layout.pen**: 전체 플레이어 레이아웃 (Desktop 1200x800, Mobile 375x812)
2. **controls-components.pen**: 재생 컨트롤, 볼륨, A-B 루프 컴포넌트
3. **waveform-theme.pen**: 파형 색상, 재생 헤드, 루프 영역 강조

### 접근성
- WCAG 2.1 Level AA 준수
- 키보드 네비게이션 완전 지원
- ARIA 라벨 모든 인터랙티브 요소에 적용
- 색상 대비 4.5:1 이상 (텍스트), 3:1 이상 (UI)
- 터치 타겟 최소 44x44px (모바일)

---

## 9. 성능 목표

| 지표 | 목표값 |
|------|--------|
| 파형 렌더링 | 60fps |
| 페이지 로드 | < 2초 |
| 재생 레이턴시 | < 50ms |
| Seek 레이턴시 | < 100ms |
| A-B 루프 전환 | < 10ms |
| 메모리 누수 | 1시간 세션 0% |

---

## 10. 브라우저 호환성

| 브라우저 | 최소 버전 |
|---------|----------|
| Chrome  | 120+     |
| Firefox | 120+     |
| Safari  | 17+      |
| Edge    | 120+     |

---

## 11. 커버리지 목표

| Layer | 목표 |
|-------|------|
| Unit Tests (Vitest) | 85%+ |
| Component Tests (RTL) | 80%+ |
| E2E Single Feature (Playwright) | 7개 핵심 시나리오 |
| E2E Compound Independence (Playwright) | 16개 테스트 (CRITICAL 8, HIGH 6, MEDIUM 2) |
| Visual Regression (Playwright) | 3개 핵심 화면 |
