# 진입점 카탈로그

> 상위 문서: [overview.md](./overview.md)

## 프론트엔드 부팅 경로

```
index.html
  └─ <script type="module" src="/src/main.tsx">
       └─ src/main.tsx      createRoot(#root).render(<StrictMode><App/></StrictMode>)
            └─ src/App.tsx  return <Player />
                 └─ src/components/Player/Player.tsx   ← 실질적 진입점
```

**중간 3단계는 전부 통과 코드입니다.** `main.tsx`는 10줄, `App.tsx`는 5줄이고 Provider도 라우터도 없습니다. 앱의 실제 부팅은 `Player.tsx` 안에서 일어납니다.

### `Player.tsx`가 하는 일

이 파일 하나가 조립 루트 역할을 전부 맡습니다.

1. 훅 9개 부팅 — `useAudioEngine` · `useStemMixer` · `useSeparation` · `useMetronome` · `useWaveform` · `useKeyboardShortcuts` · `useFileLoader` · `usePlayback` · `useSpeedPitch`
2. **활성 엔진 결정** — 스템 모드 여부에 따라 `AudioEngine`과 `StemMixer` 중 하나를 골라 `usePlayback` / `useSpeedPitch`에 넘김
3. **엔진 전환 시 위치 동기화** — 모드를 바꿀 때 한쪽 엔진의 재생 위치를 읽어 다른 쪽에 seek하고 `playerStore`에도 반영
4. `StemMixer` 볼륨 동기화 (`AudioEngine` 쪽은 `useAudioEngine` 내부에서 처리 — 소유권이 갈려 있음)
5. 패널 컴포넌트 11종 렌더

엔진 전환 상태 기계가 컴포넌트 안에 있어 단독 단위 테스트가 불가능합니다. `usePlayerEngineSwitch` 같은 훅으로 떼어내면 테스트 가능해집니다.

## Web Worker

| 위치 | 상태 |
|---|---|
| `src/core/MetronomeEngine.ts` 내부 `WORKER_SOURCE` 문자열 | **실제 동작하는 워커.** `Blob` + `URL.createObjectURL`로 런타임 생성. 25ms 간격 틱 |
| `src/workers/metronome-worker.ts` (41줄) | **미사용.** import하는 곳이 전무합니다 |

같은 lookahead 틱 로직의 사본이 두 개 있고 이미 갈라졌습니다. 메트로놈 타이밍을 고칠 때는 **`MetronomeEngine.ts` 안의 문자열**을 고쳐야 합니다.

## 백엔드 부팅 경로

```
uvicorn app.main:app
  └─ backend/app/main.py : app = create_app()
       ├─ CORSMiddleware              (config.cors_origins)
       ├─ log_requests 미들웨어        (요청 로깅)
       ├─ lifespan
       │    ├─ 다운로드 디렉터리 · 스템 캐시 디렉터리 생성
       │    ├─ asyncio.create_task(run_cleanup_loop)              ← YouTube 다운로드 정리
       │    └─ asyncio.create_task(_cleanup_expired_separation_tasks)  ← 10분마다 분리 캐시 정리
       └─ include_router × 4  (prefix="/api/v1")
```

lifespan의 백그라운드 작업 2개는 **감시받지 않는 fire-and-forget**입니다. 예외로 죽어도 재시작이나 경보가 없습니다. 개인용 로컬 도구 범위에서는 수용 가능하지만, 알려진 한계로 기록해 둡니다.

## REST 엔드포인트

모두 `/api/v1` 프리픽스 아래에 있습니다.

| 메서드 | 경로 | 라우트 파일 | 하는 일 | 레이트 리밋 |
|---|---|---|---|:---:|
| GET | `/health` | `routes/health.py:45` | ffmpeg 가용성 · 디스크 여유 · 진행 중 변환 수 | — |
| POST | `/youtube/convert` | `routes/youtube.py:38` | URL 검증 후 변환 태스크 생성, task_id 반환 | ✅ |
| GET | `/youtube/progress/{task_id}` | `routes/youtube.py:93` | SSE 진행률 스트림 | — |
| GET | `/youtube/download/{task_id}` | `routes/youtube.py:159` | 변환된 MP3 바이트 | — |
| POST | `/separate` | `routes/separation.py:36` | 오디오 업로드 → 분리 태스크 생성 | ❌ |
| GET | `/separate/{task_id}/progress` | `routes/separation.py:144` | SSE 진행률 (서버가 1초마다 폴링) | — |
| GET | `/separate/{task_id}/stems/{stem_name}` | `routes/separation.py:202` | 단일 스템 WAV | — |
| GET | `/separate/{task_id}/stems` | `routes/separation.py:258` | 전체 스템 ZIP | — |
| POST | `/bpm/analyze` | `routes/bpm.py:29` | 오디오 업로드 → BPM·비트 배열 반환 | ❌ |

**레이트 리밋이 `/youtube/convert`에만 걸려 있습니다.** `/separate`(Demucs 추론)와 `/bpm/analyze`(librosa 분석)가 CPU를 훨씬 많이 쓰는데도 무제한입니다.

## 실행 스크립트

| 진입점 | 대상 | 동작 |
|---|---|---|
| `pnpm start` → `scripts/start.sh` | macOS · Linux | 최초 실행 시 `backend/.venv` 생성 + `requirements.txt` 설치(PyTorch·Demucs 포함, 5~15분) → 백엔드와 Vite 동시 기동 |
| `scripts/start.bat` | Windows | 위와 동등 |
| `Start Guitar Trainer.command` | macOS 더블클릭 | `scripts/start.sh` 래퍼 |
| `Start Guitar Trainer.bat` | Windows 더블클릭 | `scripts/start.bat` 래퍼 |
| `pnpm dev` | 개발 | Vite만 기동 (백엔드 별도 실행 필요) |
| `pnpm build` | 배포 | `tsc && vite build` → `dist/` |
| `Makefile` | 개발 | 빌드/테스트 타깃 모음 |

전제 조건: Python 3, `pnpm`. 스크립트가 둘 다 확인하고 없으면 안내 후 종료합니다.

## 포트와 설정

| 항목 | 기본값 | 출처 |
|---|---|---|
| 백엔드 포트 | `8000` | `backend/app/config.py` `Settings.port` |
| 프론트엔드 dev 포트 | `5173` (Vite 기본) | `vite.config.ts`에 명시 없음 |
| CORS 허용 origin | `http://localhost:5173`, `http://localhost:3000` | `config.py` `Settings.cors_origins` |
| 다운로드 경로 | `/tmp/ytdlp_downloads` | `config.py` `Settings.download_dir` |
| 최대 영상 길이 | 1800초 (30분) | `config.py` `Settings.max_duration_seconds` |
| 동시 다운로드 | 5 | `config.py` `Settings.max_concurrent_downloads` |
| 분당 요청 제한 | 10 | `config.py` `Settings.rate_limit_per_minute` |

프론트엔드가 백엔드 주소를 찾는 방법은 **환경변수 두 개로 갈라져 있습니다** — 자세한 내용은 [dependencies.md의 계층 위반 ③](./dependencies.md)을 보세요.

### 경로 별칭 (`vite.config.ts`)

`@` → `src/`, `@components`, `@core`, `@stores`, `@hooks`, `@utils`, `@types`.

다만 실제 코드는 대부분 상대 경로(`../../stores/...`)를 씁니다. 별칭을 쓰는 곳은 `MetronomePanel.tsx`와 `useMetronome.ts` 정도로, 스타일이 혼재합니다.

## 테스트 진입점

| 명령 | 대상 |
|---|---|
| `pnpm test` | Vitest — `tests/unit/`, 설정은 `src/test/setup.ts` (jsdom + Web Audio 목) |
| `pnpm test:e2e` | Playwright — `tests/e2e/` 13개 스펙 (재생·A-B·속도피치·메트로놈·스템믹서·YouTube·시각회귀 등) |
| `pytest` (backend) | `backend/tests/` 9개 파일 (health · youtube api/service · separation api/service/schemas · bpm · validators) |

프론트엔드 단위 테스트는 `tests/unit/app.test.tsx` 하나뿐이고, E2E가 검증의 중심입니다. `src/core/`의 엔진들은 실시간 Web Audio 특성상 단위 테스트가 어려워 사실상 E2E로만 덮여 있습니다.

---

*각 엔드포인트가 실제로 어떤 순서로 호출되는지는 [data-flow.md](./data-flow.md)를 보세요.*
