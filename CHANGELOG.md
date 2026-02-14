# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-14

### Added

- **Audio Engine**: Web Audio API 기반 오디오 엔진 구현
  - AudioContext 생명주기 관리
  - 오디오 버퍼 로딩 및 디코딩
  - 재생/일시정지/정지 제어
  - 시간 탐색 (seek)
  - 볼륨 제어

- **A-B Loop**: 구간 반복 재생 기능
  - A 지점 / B 지점 설정
  - 루프 활성화/비활성화
  - 루프 영역 시각화

- **Waveform Visualization**: 파형 시각화
  - wavesurfer.js 통합
  - 클릭으로 탐색
  - 재생 진행 표시

- **File Loader**: 파일 로딩
  - 드래그 앤 드롭 지원
  - MP3, WAV, M4A, OGG 형식 지원
  - 파일 크기 표시

- **Keyboard Shortcuts**: 키보드 단축키
  - Space: 재생/일시정지
  - I/O: A/B 지점 설정
  - A: A 지점으로 이동
  - M: 뮤트 토글
  - 화살표: 5초 탐색

- **State Management**: Zustand 스토어
  - audioStore: 오디오 상태
  - playerStore: 플레이어 상태
  - controlStore: 컨트롤 상태
  - loopStore: 루프 상태

- **UI Components**: 14개 UI 컴포넌트
  - Layout (Header, Footer)
  - FileLoader (DropZone)
  - Waveform (WaveformDisplay)
  - Controls (PlayButton, StopButton)
  - Volume (VolumeSlider, MuteButton)
  - ABLoop (ABLoopControls)
  - Player (Player)

- **Testing**: 190개 단위 테스트
  - AudioEngine 테스트
  - ABLoopManager 테스트
  - WaveformRenderer 테스트
  - 스토어 테스트
  - 유틸리티 테스트

### Technical Details

- React 19.0.0
- TypeScript 5.9.x (strict mode)
- Vite 6.x
- Tailwind CSS 4.x
- Zustand 5.x
- wavesurfer.js 7.8.x
- Vitest + React Testing Library
