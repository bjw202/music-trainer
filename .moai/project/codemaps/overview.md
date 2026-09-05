# 아키텍처 개요 — Guitar MP3 Trainer v2

> 생성: 2026-09-05 · 대상 커밋: `bc3ee95` · 범위: `src/` (프론트엔드), `backend/app/` (백엔드)
> 갱신 방법: `/moai codemaps --force`

## 한 문단 요약

기타 연습용 오디오 플레이어입니다. 브라우저에서 MP3를 열어 **음정을 유지한 채 속도를 바꾸고**, **A-B 구간을 반복**하고, **메트로놈을 곡 박자에 맞춰 울리고**, 곡을 **4개 스템(보컬/드럼/베이스/기타)으로 분리**해 따로 볼륨을 조절합니다. 화면과 오디오 재생은 전부 브라우저에서 처리하고, CPU가 많이 드는 세 가지 작업 — 스템 분리, YouTube 다운로드, BPM 검출 — 만 로컬 Python 서버로 넘깁니다.

## 두 개의 실행 단위

| | 프론트엔드 | 백엔드 |
|---|---|---|
| 위치 | `src/` | `backend/app/` |
| 스택 | React 19 · TypeScript 5.7 · Vite 6 · Zustand 5 · Tailwind 4 | FastAPI · Python 3.12 · uvicorn |
| 규모 | 78개 파일 · 8,784줄 | 18개 파일 · 2,594줄 |
| 핵심 기술 | Web Audio API, soundtouchjs(속도·피치), wavesurfer.js(파형) | demucs+torch(스템 분리), yt-dlp(YouTube), librosa(BPM) |
| 통신 | `fetch` + `EventSource`(SSE) | `/api/v1` REST + SSE |
| 상태 저장소 | Zustand 스토어 7개 | 인메모리 태스크 dict (DB 없음) |

**서버 없이도 동작합니다.** 로컬 파일 재생·속도·피치·A-B 반복·파형은 전부 프론트엔드만으로 완결됩니다. 백엔드가 꺼져 있으면 스템 분리·YouTube 변환·BPM 자동 검출만 실패합니다.

## 계층 구조

```
┌─────────────────────────────────────────────────────────┐
│ Presentation   src/components/**  (11개 기능 폴더)        │
│                Player.tsx 가 전체 조립을 담당              │
├─────────────────────────────────────────────────────────┤
│ Glue (Hooks)   src/hooks/**  (10개)                      │
│                React 생명주기 ↔ 엔진/스토어 배선           │
├─────────────────────────────────────────────────────────┤
│ State          src/stores/**  (Zustand 7개)              │
├─────────────────────────────────────────────────────────┤
│ Domain Engine  src/core/**  (React 비의존, 순수 Web Audio) │
│                AudioEngine · StemMixer · MetronomeEngine  │
├─────────────────────────────────────────────────────────┤
│ Integration    src/api/**  → HTTP/SSE → backend/app/routes│
├─────────────────────────────────────────────────────────┤
│ Service        backend/app/services/**  (외부 도구 래핑)   │
└─────────────────────────────────────────────────────────┘
```

계층 방향은 대체로 지켜집니다. `src/core/`는 `stores/`·`hooks/`를 import하지 않고, `stores/`는 `core/`를 import하지 않으며, `hooks/`가 그 사이를 중개합니다. **순환 의존은 발견되지 않았습니다.** 예외 2건은 [dependencies.md](./dependencies.md) 참조.

## 아키텍처 패턴

- **이중 엔진 + 런타임 전환**: `AudioEngine`(단일 트랙)과 `StemMixer`(4스템)가 나란히 존재하고, `Player.tsx`가 스템 모드 여부에 따라 둘 중 하나를 `activeEngine`으로 골라 하위 훅에 넘깁니다. 두 클래스는 동일한 soundtouchjs 파이프라인 형태를 각자 구현합니다.
- **Lookahead 스케줄링**: 메트로놈은 React 렌더 주기(16ms)나 오디오 버퍼 주기(약 93ms)에 의존하지 않고, 25ms 워커 틱 + 선형 보간 시계로 100ms 앞을 미리 예약합니다 (Chris Wilson 방식).
- **비침습 리스너 채널**: `AudioEngine`이 시간/시크/속도/재생상태 4종 리스너 집합을 노출하고, 메트로놈이 React를 우회해 여기에 직접 붙습니다.
- **폴링 기반 비동기 작업**: 스템 분리·YouTube 변환 모두 서버가 태스크 ID를 즉시 반환하고, 클라이언트가 SSE로 진행률을 구독합니다. 큐·워커 프로세스 없이 `asyncio.create_task`로 처리합니다.
- **선택적 무거운 의존성**: demucs/torch가 없으면 서버가 mock 경로로 조용히 대체됩니다 ([아래 위험](#주의해야-할-점) 참조).

## 문서 지도

| 문서 | 담는 내용 |
|---|---|
| [modules.md](./modules.md) | 모듈별 책임 · 줄 수 · 소속 계층 |
| [dependencies.md](./dependencies.md) | import 그래프(mermaid) · fan-in 순위 · 계층 위반 · 외부 라이브러리 |
| [entry-points.md](./entry-points.md) | 실행 진입점 · REST 엔드포인트 표 · 실행 스크립트 |
| [data-flow.md](./data-flow.md) | 5가지 핵심 흐름을 함수 단위로 추적 |

## 주의해야 할 점

아키텍처를 읽을 때 먼저 알아야 할 사실들입니다. 모두 직접 확인했습니다.

1. **죽은 코드 3건이 `core/index.ts`에 export되어 있습니다.** `ABLoopManager.ts`(165줄), `WaveformRenderer.ts`(271줄), `src/workers/metronome-worker.ts`(41줄) — 어디서도 import되지 않습니다. 각 기능의 실제 구현은 다른 곳에 있습니다(modules.md 참조). 파일 이름만 보고 "여기가 구현부"라고 판단하면 틀립니다.

2. ~~**백엔드 origin 환경변수가 두 개입니다.**~~ **[해결됨]** `bpmStore.ts`가 읽던 `VITE_API_URL`을 제거하고 `src/api/bpm.ts`에 위임하도록 바꿨습니다. 이제 프론트엔드 전체가 `VITE_API_BASE_URL` 하나만 읽습니다 — 소유자는 `src/api/client.ts:7`입니다.

3. **스템 분리가 조용히 가짜로 대체될 수 있습니다.** demucs가 설치되지 않은 환경에서 `separation_service._run_mock_separation`이 원본을 4번 복사하거나(ffmpeg 있을 때) 5초짜리 무음 WAV를 생성합니다. API 응답 스키마에 이를 알리는 필드가 없어 프론트엔드는 진짜 분리로 인식합니다.

4. **메트로놈은 스템 모드에서 동작하지 않습니다.** `useMetronome`은 `AudioEngine`의 리스너에만 연결되고, `StemMixer`에는 대응하는 리스너 배선이 없습니다.

5. **레이트 리밋이 `/youtube/convert`에만 걸려 있습니다.** CPU를 훨씬 많이 쓰는 `/separate`와 `/bpm/analyze`는 무제한입니다.

---

*이 문서는 `/moai codemaps`가 생성했습니다. 손으로 고친 내용은 다음 재생성 때 덮어써집니다.*
