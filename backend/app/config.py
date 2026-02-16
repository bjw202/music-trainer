"""애플리케이션 환경 설정 모듈.

pydantic-settings를 사용하여 환경 변수에서 설정을 로드합니다.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """애플리케이션 설정.

    환경 변수 또는 .env 파일에서 값을 로드합니다.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # 다운로드 디렉터리
    download_dir: str = "/tmp/ytdlp_downloads"

    # 최대 영상 길이 (초)
    max_duration_seconds: int = 1800

    # 동시 다운로드 제한
    max_concurrent_downloads: int = 5

    # 분당 요청 제한
    rate_limit_per_minute: int = 10

    # CORS 허용 오리진 (str로 받아 pydantic-settings JSON 우선 파싱 우회)
    cors_origins: str = (
        "https://music-trainer-sigma.vercel.app,"
        "http://localhost:5173,"
        "http://localhost:3000"
    )

    # 서버 포트
    port: int = 8000

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> str:
        """CORS 오리진 입력을 str로 정규화합니다."""
        if isinstance(v, list):
            return ",".join(str(o) for o in v)
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        """파싱된 CORS 오리진 리스트를 반환합니다."""
        v = self.cors_origins
        try:
            parsed = json.loads(v)
            if isinstance(parsed, list):
                return [str(o).strip() for o in parsed]
        except (json.JSONDecodeError, TypeError):
            pass
        return [origin.strip() for origin in v.split(",") if origin.strip()]

    def get_download_path(self) -> Path:
        """다운로드 디렉터리 Path 객체를 반환합니다."""
        return Path(self.download_dir)


def get_settings() -> Settings:
    """싱글턴 Settings 인스턴스를 반환합니다."""
    return Settings()
