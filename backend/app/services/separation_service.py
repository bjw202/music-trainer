"""음원 분리 서비스.

Demucs를 사용하여 오디오 파일을 4개 스템(vocals, drums, bass, other)으로 분리합니다.
파일 해시 기반 캐싱, 동시 처리 제한, 진행률 콜백을 지원합니다.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Demucs/PyTorch 가용성 확인
_DEMUCS_AVAILABLE = False
try:
    import torch
    import torchaudio
    from demucs.apply import apply_model
    from demucs.pretrained import get_model
    from demucs.audio import save_audio

    # CPU 전용 최적화
    torch.set_num_threads(4)
    torch.set_grad_enabled(False)

    _DEMUCS_AVAILABLE = True
    logger.info("Demucs/PyTorch loaded successfully (CPU mode)")
except ImportError as _import_err:
    logger.warning(
        "Demucs 또는 PyTorch를 로드할 수 없습니다: %s. "
        "무음 WAV 폴백 모드를 사용합니다. "
        "설치: pip install demucs torch torchaudio --index-url "
        "https://download.pytorch.org/whl/cpu",
        _import_err,
    )

# 지원되는 스템 이름
STEM_NAMES = ["vocals", "drums", "bass", "other"]


@dataclass
class SeparationTask:
    """분리 태스크 상태 데이터 모델."""

    status: str  # pending, processing, completed, failed, queued
    progress: float  # 0.0-100.0
    file_hash: str | None = None
    stems: dict[str, Path] | None = None  # 스템 파일 경로
    error: str | None = None
    _created_at: float = field(default_factory=lambda: __import__("time").time())


class SeparationService:
    """Demucs 음원 분리 서비스.

    특징:
    - Demucs htdemucs 모델 사용 (지연 로딩, 싱글톤)
    - 파일 해시 기반 캐싱
    - asyncio.Semaphore로 동시 처리 제한
    - 진행률 콜백 지원
    - 임시 파일 자동 정리
    """

    _model: Any = None  # 클래스 레벨 싱글톤 모델

    def __init__(
        self,
        cache_dir: str | None = None,
        max_concurrent: int = 2,
    ) -> None:
        """SeparationService를 초기화합니다.

        Args:
            cache_dir: 스템 캐시 디렉터리 경로.
            max_concurrent: 최대 동시 처리 수.
        """
        self.cache_dir = Path(cache_dir or "/tmp/stems_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._tasks: dict[str, SeparationTask] = {}

        logger.info("SeparationService initialized with cache_dir=%s", self.cache_dir)

    @property
    def tasks(self) -> dict[str, SeparationTask]:
        """현재 태스크 상태 딕셔너리를 반환합니다."""
        return self._tasks

    @property
    def active_count(self) -> int:
        """현재 진행 중인 분리 작업 수를 반환합니다."""
        return sum(
            1 for t in self._tasks.values() if t.status in ("processing", "queued")
        )

    def create_task(self) -> str:
        """새 태스크를 생성하고 task_id를 반환합니다."""
        task_id = str(uuid.uuid4())
        self._tasks[task_id] = SeparationTask(
            status="pending",
            progress=0.0,
        )
        return task_id

    def get_task(self, task_id: str) -> SeparationTask | None:
        """태스크 상태를 반환합니다."""
        return self._tasks.get(task_id)

    def remove_task(self, task_id: str) -> None:
        """태스크를 제거합니다."""
        self._tasks.pop(task_id, None)

    def _get_file_hash(self, file_path: Path) -> str:
        """파일의 SHA256 해시를 계산합니다.

        Args:
            file_path: 파일 경로.

        Returns:
            16진수 해시 문자열.
        """
        sha256 = hashlib.sha256()
        with file_path.open("rb") as f:
            # 파일을 청크로 읽어 메모리 사용량 최적화
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _get_cache_path(self, file_hash: str) -> Path:
        """해시에 대한 캐시 디렉터리 경로를 반환합니다."""
        return self.cache_dir / file_hash

    def _get_cached_stems(self, file_hash: str) -> dict[str, Path] | None:
        """캐시된 스템 파일 경로를 반환합니다.

        Args:
            file_hash: 파일 해시.

        Returns:
            스텐 이름에서 파일 경로로의 매핑, 또는 None.
        """
        cache_path = self._get_cache_path(file_hash)

        if not cache_path.exists():
            return None

        stems: dict[str, Path] = {}
        for stem_name in STEM_NAMES:
            stem_file = cache_path / f"{stem_name}.wav"
            if not stem_file.exists():
                return None
            stems[stem_name] = stem_file

        return stems

    def _create_silent_wav(
        self,
        output_path: Path,
        duration_seconds: float = 5.0,
        sample_rate: int = 44100,
        channels: int = 2,
    ) -> None:
        """무음 WAV 파일을 생성합니다.

        Web Audio API에서 디코딩 가능한 유효한 WAV 파일을 생성합니다.

        Args:
            output_path: 출력 파일 경로.
            duration_seconds: 길이 (초).
            sample_rate: 샘플 레이트 (Hz).
            channels: 채널 수 (1=모노, 2=스테레오).
        """
        import struct

        num_samples = int(sample_rate * duration_seconds)
        bytes_per_sample = 2  # 16-bit
        byte_rate = sample_rate * channels * bytes_per_sample
        block_align = channels * bytes_per_sample
        data_size = num_samples * block_align

        with output_path.open("wb") as f:
            # RIFF 헤더
            f.write(b"RIFF")
            f.write(struct.pack("<I", 36 + data_size))  # 파일 크기 - 8
            f.write(b"WAVE")

            # fmt 청크
            f.write(b"fmt ")
            f.write(struct.pack("<I", 16))  # 청크 크기
            f.write(struct.pack("<H", 1))   # 오디오 포맷 (1 = PCM)
            f.write(struct.pack("<H", channels))
            f.write(struct.pack("<I", sample_rate))
            f.write(struct.pack("<I", byte_rate))
            f.write(struct.pack("<H", block_align))
            f.write(struct.pack("<H", 16))  # 비트 깊이

            # data 청크
            f.write(b"data")
            f.write(struct.pack("<I", data_size))

            # 무음 데이터 (0으로 채움)
            f.write(b"\x00" * data_size)

    def _update_progress(
        self,
        task_id: str,
        progress: float,
        status: str,
        error: str | None = None,
    ) -> None:
        """태스크 진행률을 업데이트합니다."""
        if task_id in self._tasks:
            self._tasks[task_id].progress = progress
            self._tasks[task_id].status = status
            if error:
                self._tasks[task_id].error = error

    async def _ensure_model_loaded(self) -> None:
        """Demucs 모델이 로드되었는지 확인합니다.

        지연 로딩: 첫 번째 분리 요청 시 모델을 로드합니다.
        Demucs가 설치되지 않은 환경에서는 mock 모델로 폴백합니다.
        """
        if SeparationService._model is not None:
            return

        if not _DEMUCS_AVAILABLE:
            logger.warning(
                "Demucs를 사용할 수 없어 mock 모델을 로드합니다. "
                "실제 음원 분리를 위해 demucs, torch, torchaudio를 설치하세요."
            )
            SeparationService._model = {"name": "htdemucs_mock", "loaded": True}
            return

        logger.info("Loading Demucs htdemucs model (CPU)...")

        def _load_model():
            model = get_model("htdemucs")
            model.cpu()
            model.eval()
            return model

        try:
            SeparationService._model = await asyncio.to_thread(_load_model)
            logger.info(
                "Demucs model loaded successfully. sources=%s",
                SeparationService._model.sources,
            )
        except Exception as e:
            logger.error("Failed to load Demucs model: %s", e)
            raise RuntimeError(f"모델 로딩 실패: {e}") from e

    def _run_demucs_separation(
        self,
        file_path: Path,
        cache_path: Path,
        task_id: str,
    ) -> dict[str, Path]:
        """Demucs 분리를 동기적으로 실행합니다 (스레드풀에서 호출).

        Args:
            file_path: 입력 오디오 파일 경로.
            cache_path: 스템 캐시 디렉터리.
            task_id: 태스크 ID.

        Returns:
            스템 이름에서 파일 경로로의 매핑.

        Raises:
            RuntimeError: 분리 실패 시.
        """
        model = SeparationService._model

        # 오디오 로드
        self._update_progress(task_id, 20.0, "processing")
        try:
            wav, sr = torchaudio.load(str(file_path))
        except Exception as e:
            raise RuntimeError(f"오디오 파일을 로드할 수 없습니다: {e}") from e

        # 채널 포맷 보정 (스테레오 필요)
        if wav.shape[0] > 2:
            wav = wav[:2]  # 처음 2채널만 사용
        if wav.shape[0] == 1:
            wav = wav.repeat(2, 1)  # 모노 -> 스테레오

        # 리샘플링 (htdemucs는 44100Hz 기대)
        if sr != model.samplerate:
            logger.info(
                "Resampling from %dHz to %dHz", sr, model.samplerate
            )
            wav = torchaudio.transforms.Resample(sr, model.samplerate)(wav)

        # 배치 차원 추가: (channels, samples) -> (1, channels, samples)
        wav = wav.unsqueeze(0)

        # 분리 실행
        self._update_progress(task_id, 30.0, "processing")
        logger.info(
            "Running Demucs separation (task=%s, duration=%.1fs)...",
            task_id,
            wav.shape[-1] / model.samplerate,
        )

        with torch.no_grad():
            sources = apply_model(
                model,
                wav,
                device="cpu",
                shifts=1,
                overlap=0.25,
                progress=False,
            )
        # sources shape: (1, num_sources, channels, samples)

        # 모델의 소스 순서에 따라 스템 매핑
        # htdemucs: model.sources = ['drums', 'bass', 'other', 'vocals']
        self._update_progress(task_id, 90.0, "processing")

        stems: dict[str, Path] = {}
        for i, source_name in enumerate(model.sources):
            stem_file = cache_path / f"{source_name}.wav"
            save_audio(
                sources[0, i],
                str(stem_file),
                samplerate=model.samplerate,
            )
            stems[source_name] = stem_file

        # STEM_NAMES에 있는 모든 스템이 생성되었는지 확인
        missing = [s for s in STEM_NAMES if s not in stems]
        if missing:
            logger.warning(
                "모델에서 생성되지 않은 스템: %s. "
                "모델 소스 목록: %s",
                missing,
                model.sources,
            )

        self._update_progress(task_id, 95.0, "processing")
        return stems

    def _convert_to_wav(self, input_path: Path, output_path: Path) -> bool:
        """ffmpeg를 사용하여 오디오 파일을 WAV로 변환합니다.

        Args:
            input_path: 입력 오디오 파일 경로.
            output_path: 출력 WAV 파일 경로.

        Returns:
            변환 성공 여부.
        """
        import subprocess

        try:
            result = subprocess.run(
                [
                    "ffmpeg", "-y", "-i", str(input_path),
                    "-ar", "44100", "-ac", "2", "-sample_fmt", "s16",
                    str(output_path),
                ],
                capture_output=True,
                timeout=120,
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def _run_mock_separation(
        self,
        file_path: Path,
        cache_path: Path,
        task_id: str,
    ) -> dict[str, Path]:
        """Mock 분리를 실행합니다 (Demucs 미설치 시 폴백).

        ffmpeg가 설치된 경우 원본 오디오를 WAV로 변환하여 각 stem으로 복사합니다.
        ffmpeg도 없으면 무음 WAV를 생성합니다.

        Args:
            file_path: 입력 오디오 파일 경로.
            cache_path: 스템 캐시 디렉터리.
            task_id: 태스크 ID.

        Returns:
            스템 이름에서 파일 경로로의 매핑.
        """
        import shutil

        logger.warning(
            "Demucs가 설치되지 않아 원본 오디오를 각 stem으로 복사합니다 (task=%s). "
            "실제 음원 분리를 위해 demucs를 설치하세요.",
            task_id,
        )

        # ffmpeg로 원본을 WAV 변환 시도
        first_stem_file = cache_path / f"{STEM_NAMES[0]}.wav"
        self._update_progress(task_id, 30.0, "processing")

        use_ffmpeg = self._convert_to_wav(file_path, first_stem_file)

        stems: dict[str, Path] = {}
        if use_ffmpeg and first_stem_file.exists():
            # 첫 번째 stem은 이미 생성됨, 나머지는 복사
            stems[STEM_NAMES[0]] = first_stem_file
            for i, stem_name in enumerate(STEM_NAMES[1:], start=1):
                progress = 30 + (i + 1) * 15
                self._update_progress(task_id, float(progress), "processing")
                stem_file = cache_path / f"{stem_name}.wav"
                shutil.copy2(first_stem_file, stem_file)
                stems[stem_name] = stem_file
            logger.info("ffmpeg로 원본 오디오를 %d개 stem으로 복사 완료", len(stems))
        else:
            # ffmpeg 미설치 시 무음 WAV 폴백
            logger.warning("ffmpeg 미설치 - 무음 WAV 생성 폴백 사용")
            for i, stem_name in enumerate(STEM_NAMES):
                progress = 30 + (i + 1) * 15
                self._update_progress(task_id, float(progress), "processing")
                stem_file = cache_path / f"{stem_name}.wav"
                self._create_silent_wav(stem_file, duration_seconds=5.0)
                stems[stem_name] = stem_file

        self._update_progress(task_id, 95.0, "processing")
        return stems

    async def separate(
        self,
        file_path: str | Path,
        task_id: str,
    ) -> dict[str, Path]:
        """오디오 파일을 4개 스템으로 분리합니다.

        Demucs가 설치된 경우 실제 AI 분리를 수행하고,
        미설치 시 무음 WAV 폴백을 사용합니다.

        Args:
            file_path: 입력 오디오 파일 경로.
            task_id: 태스크 ID.

        Returns:
            스템 이름에서 파일 경로로의 매핑.

        Raises:
            FileNotFoundError: 파일이 존재하지 않을 때.
            RuntimeError: 분리 실패 시.
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")

        async with self._semaphore:
            try:
                # 5% - 파일 해시 계산
                self._update_progress(task_id, 5.0, "processing")
                file_hash = await asyncio.to_thread(self._get_file_hash, file_path)
                self._tasks[task_id].file_hash = file_hash

                # 캐시 확인
                cached_stems = self._get_cached_stems(file_hash)
                if cached_stems:
                    logger.info("Using cached stems for hash=%s", file_hash[:16])
                    self._update_progress(task_id, 100.0, "completed")
                    self._tasks[task_id].stems = cached_stems
                    return cached_stems

                # 10% - 모델 로드
                self._update_progress(task_id, 10.0, "processing")
                await self._ensure_model_loaded()

                # 캐시 디렉터리 생성
                cache_path = self._get_cache_path(file_hash)
                cache_path.mkdir(parents=True, exist_ok=True)

                # 20-95% - 분리 실행
                if _DEMUCS_AVAILABLE and not isinstance(
                    SeparationService._model, dict
                ):
                    stems = await asyncio.to_thread(
                        self._run_demucs_separation,
                        file_path,
                        cache_path,
                        task_id,
                    )
                else:
                    stems = await asyncio.to_thread(
                        self._run_mock_separation,
                        file_path,
                        cache_path,
                        task_id,
                    )

                # 100% - 완료
                self._update_progress(task_id, 100.0, "completed")
                self._tasks[task_id].stems = stems

                logger.info(
                    "Separation completed for task=%s, hash=%s, demucs=%s",
                    task_id,
                    file_hash[:16],
                    _DEMUCS_AVAILABLE,
                )

                return stems

            except Exception as e:
                # 실패 시 부분 출력 정리
                if task_id in self._tasks and self._tasks[task_id].file_hash:
                    partial_cache = self._get_cache_path(
                        self._tasks[task_id].file_hash
                    )
                    if partial_cache.exists():
                        import shutil

                        shutil.rmtree(partial_cache, ignore_errors=True)
                        logger.info(
                            "Cleaned up partial output for task=%s", task_id
                        )

                raise


# 전역 서비스 인스턴스
separation_service = SeparationService()
