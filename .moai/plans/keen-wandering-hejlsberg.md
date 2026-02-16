# SPEC-UI-001: UI Professional Redesign

## Context

Guitar MP3 Trainer v2의 UI가 습작 수준이며, 전문 음악 프로그램(Logic Pro, Ableton) 느낌으로 개선이 필요합니다. Pencil MCP로 디자인 프로토타입을 먼저 작성한 뒤, SPEC 문서를 생성하고 expert-frontend로 구현합니다.

### 사용자 요구사항
1. 초기 화면: 글씨 크기 확대, YouTube "변환" 버튼 영어 통일
2. 플레이어 화면: 섹션 라벨(Speed/Pitch, A-B Loop, Stem Separation) 디자인 개선
3. "Separate Stems", "Load New File" 버튼 시인성 강화
4. Stem Mixer: Vocal(Mic), Drums(Drum), Bass(Guitar), Other(Guitar) 아이콘 추가
5. 전체적으로 전문 음악 프로그램 수준의 UI

### 기존 디자인 에셋
- `designs/forms.pen` 파일에 2개의 기존 디자인 프레임 존재:
  - `YXFk4`: Music Trainer Start Screen (Oswald + JetBrains Mono, 다크 테마)
  - `GUUJO`: SpeedPitch Panel
- 스타일: Industrial Technical Dark (Oswald 헤더, JetBrains Mono 본문, 다크 그레이 레이어)

---

## 실행 단계

### Step 1: Pencil 디자인 - Player Screen 작성

`designs/forms.pen`에 Player Screen 프레임을 새로 추가합니다.

**디자인 포함 요소:**
- Waveform 영역 (placeholder)
- 타임 디스플레이 (current / total)
- Transport 컨트롤 (Stop, Play/Pause)
- Volume 컨트롤
- Speed & Pitch 섹션 (기존 GUUJO 패널 활용)
  - 섹션 라벨: Lucide `gauge` 아이콘 + "SPEED & PITCH" (uppercase, Oswald)
- A-B Loop 섹션
  - 섹션 라벨: Lucide `repeat` 아이콘 + "A-B LOOP" (uppercase, Oswald)
- Stem Separation 섹션
  - 섹션 라벨: Lucide `scissors` 아이콘 + "AI STEM SEPARATION" (uppercase, Oswald)
  - "Separate Stems" 버튼: full-width, 아이콘 + 텍스트, 테두리 있는 눈에 띄는 스타일
- Stem Mixer 섹션
  - 섹션 라벨: Lucide `sliders-horizontal` 아이콘 + "STEM MIXER" (uppercase, Oswald)
  - 4개 StemTrack: Mic(Vocals), Drum(Drums), Guitar(Bass), Guitar(Other) 아이콘
  - 각 트랙: 아이콘 + 라벨 + 슬라이더 + 게인% + M버튼 + S버튼
- "Load New File" 버튼: full-width, Lucide `folder-open` 아이콘, 명확한 버튼 스타일
- 키보드 단축키 힌트: kbd pill 스타일

**디자인 스타일 참조:**
- 색상: #1A1A1A(배경), #212121(카드), #2D2D2D(elevated), #FF6B35(accent)
- 타이포: Oswald(섹션 헤더), JetBrains Mono(본문)
- 모서리: 16px 통일
- Lucide 아이콘 시스템

### Step 2: Pencil 디자인 - Start Screen 업데이트

기존 `YXFk4` 프레임을 복사하여 개선 버전 제작:
- 헤더 타이틀 유지 (이미 Oswald 36px로 적절)
- YouTube 입력 필드 "Convert" 버튼 확인
- Drop Zone 텍스트 크기 및 browse 버튼 시인성 확인

### Step 3: SPEC 문서 생성

`/moai plan` 워크플로우로 SPEC-UI-001 문서를 `.moai/specs/SPEC-UI-001/` 에 생성:
- Pencil 디자인을 참조하는 EARS 포맷 요구사항
- 인수 조건 (acceptance criteria)
- 수정 대상 파일 목록

### Step 4: 구현 (/moai run)

expert-frontend 에이전트가 SPEC + Pencil 디자인 기반으로 구현:

**수정 대상 파일 (11개):**

| 파일 | 변경 내용 |
|------|-----------|
| `package.json` | lucide-react 추가 |
| `src/components/Layout/Header.tsx` | Oswald 폰트 적용, 이모지->아이콘 |
| `src/components/Player/Player.tsx` | 섹션 라벨 아이콘+uppercase, 버튼 시인성, 카드 레이아웃 |
| `src/components/YouTube/YouTubeInput.tsx` | "변환"->"Convert", 스타일 통일 |
| `src/components/FileLoader/DragDropZone.tsx` | 텍스트 크기, 버튼 스타일 |
| `src/components/StemMixer/StemTrack.tsx` | Stem 아이콘 추가, 레이아웃 |
| `src/components/StemMixer/StemMixerPanel.tsx` | 섹션 헤더 아이콘 |
| `src/components/StemMixer/SeparationButton.tsx` | 아이콘+full-width+시인성 |
| `src/components/SpeedPitch/SpeedPitchPanel.tsx` | 섹션 라벨 아이콘 |
| `src/components/ABLoop/ABLoopControls.tsx` | 스타일 미세 조정 |
| `src/stores/stemStore.ts` | STEM_ICONS 상수 추가 |

**Primary Accent 색상 변경 (확정):**
- 기존 인디고(#818CF8) -> 오렌지(#FF6B35)로 전면 교체
- Success/Active 색상: #00D4AA (Teal) 유지
- tailwind.config.ts의 accent.primary 변경 필요

**Stem 아이콘 매핑 (확정):**
- Vocals: Mic (lucide) - `#8B5CF6`
- Drums: 커스텀 Drum SVG - `#EF4444`
- Bass: Guitar (lucide) - `#3B82F6`
- Other: Guitar (lucide) - `#10B981`

### Step 5: 검증

1. `npm run dev`로 시각적 확인
2. `npm run typecheck` TypeScript 오류 없음
3. `npm run lint` 통과
4. `npm run test` 기존 테스트 통과
5. Pencil `get_screenshot`로 디자인과 구현 비교

---

## 변경하지 않는 것

- 오디오 엔진 로직 (core/)
- Zustand 스토어 구조 (상수 추가만)
- 컴포넌트 파일 구조 (새 파일 생성 최소화)
- 기존 접근성 속성 (aria-label 등 유지)
