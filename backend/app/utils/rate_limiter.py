"""IP 기반 요율 제한 모듈.

인메모리 방식으로 IP별 요청 횟수를 추적하여 분당 제한을 적용합니다.
"""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, status


class RateLimiter:
    """인메모리 IP 기반 요율 제한기.

    각 IP 주소의 요청 타임스탬프를 기록하고,
    설정된 분당 제한을 초과하면 429 에러를 발생시킵니다.
    """

    def __init__(self, max_requests_per_minute: int = 10) -> None:
        self.max_requests_per_minute = max_requests_per_minute
        # IP -> 요청 타임스탬프 리스트
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check_rate_limit(self, client_ip: str) -> None:
        """요율 제한을 확인합니다.

        Args:
            client_ip: 클라이언트 IP 주소.

        Raises:
            HTTPException: 요율 제한 초과 시 429 에러.
        """
        now = time.time()
        window_start = now - 60.0  # 1분 윈도우

        # 만료된 요청 제거
        timestamps = self._requests[client_ip]
        self._requests[client_ip] = [
            ts for ts in timestamps if ts > window_start
        ]

        # 제한 확인
        if len(self._requests[client_ip]) >= self.max_requests_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
            )

        # 현재 요청 기록
        self._requests[client_ip].append(now)

    def reset(self) -> None:
        """모든 요율 제한 기록을 초기화합니다."""
        self._requests.clear()


# 전역 요율 제한기 인스턴스
rate_limiter = RateLimiter()
