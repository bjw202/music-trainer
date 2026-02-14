"""YouTube URL 검증 유틸리티.

YouTube URL의 유효성을 검사하여 허용된 호스트와 형식만 통과시킵니다.
"""

from __future__ import annotations

from urllib.parse import urlparse

# 허용된 YouTube 호스트 목록
ALLOWED_HOSTS: set[str] = {
    "www.youtube.com",
    "youtube.com",
    "m.youtube.com",
    "youtu.be",
    "music.youtube.com",
}

# 허용된 URL 스킴
ALLOWED_SCHEMES: set[str] = {"http", "https"}


def validate_youtube_url(url: str) -> bool:
    """YouTube URL의 유효성을 검사합니다.

    Args:
        url: 검증할 URL 문자열.

    Returns:
        유효한 YouTube URL이면 True, 아니면 False.
    """
    if not url or not isinstance(url, str):
        return False

    url = url.strip()
    if not url:
        return False

    try:
        parsed = urlparse(url)
    except ValueError:
        return False

    # 스킴 검증
    if parsed.scheme not in ALLOWED_SCHEMES:
        return False

    # 호스트 검증
    hostname = parsed.hostname
    if not hostname:
        return False

    if hostname not in ALLOWED_HOSTS:
        return False

    # 경로 기반 형식 검증
    path = parsed.path

    if hostname == "youtu.be":
        # youtu.be/VIDEO_ID 형식
        # 경로가 / 뒤에 비디오 ID가 있어야 함
        if not path or path == "/":
            return False
        return True

    # youtube.com 계열 호스트
    if hostname in {
        "www.youtube.com",
        "youtube.com",
        "m.youtube.com",
        "music.youtube.com",
    }:
        # /watch?v=VIDEO_ID 형식
        if path == "/watch":
            query = parsed.query
            if "v=" in query:
                return True
            return False

        # /shorts/VIDEO_ID 형식
        if path.startswith("/shorts/") and len(path) > len("/shorts/"):
            return True

        return False

    return False
