"""YouTube URL 검증 테스트."""

from __future__ import annotations

import pytest

from app.utils.validators import ALLOWED_HOSTS, validate_youtube_url


class TestValidYouTubeUrls:
    """유효한 YouTube URL 테스트."""

    def test_standard_watch_url(self) -> None:
        """표준 youtube.com/watch URL을 허용합니다."""
        assert validate_youtube_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    def test_watch_url_without_www(self) -> None:
        """www 없는 youtube.com/watch URL을 허용합니다."""
        assert validate_youtube_url("https://youtube.com/watch?v=dQw4w9WgXcQ")

    def test_mobile_watch_url(self) -> None:
        """모바일 m.youtube.com/watch URL을 허용합니다."""
        assert validate_youtube_url("https://m.youtube.com/watch?v=dQw4w9WgXcQ")

    def test_youtu_be_short_url(self) -> None:
        """youtu.be 단축 URL을 허용합니다."""
        assert validate_youtube_url("https://youtu.be/dQw4w9WgXcQ")

    def test_music_youtube_url(self) -> None:
        """music.youtube.com URL을 허용합니다."""
        assert validate_youtube_url("https://music.youtube.com/watch?v=dQw4w9WgXcQ")

    def test_shorts_url(self) -> None:
        """youtube.com/shorts URL을 허용합니다."""
        assert validate_youtube_url("https://www.youtube.com/shorts/dQw4w9WgXcQ")

    def test_http_scheme(self) -> None:
        """HTTP 스킴도 허용합니다."""
        assert validate_youtube_url("http://www.youtube.com/watch?v=dQw4w9WgXcQ")

    def test_watch_url_with_extra_params(self) -> None:
        """추가 쿼리 파라미터가 있는 URL을 허용합니다."""
        assert validate_youtube_url(
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz&t=120"
        )


class TestInvalidYouTubeUrls:
    """유효하지 않은 YouTube URL 테스트."""

    def test_empty_string(self) -> None:
        """빈 문자열을 거부합니다."""
        assert not validate_youtube_url("")

    def test_none_value(self) -> None:
        """None 값을 거부합니다."""
        assert not validate_youtube_url(None)  # type: ignore[arg-type]

    def test_whitespace_only(self) -> None:
        """공백만 있는 문자열을 거부합니다."""
        assert not validate_youtube_url("   ")

    def test_non_youtube_domain(self) -> None:
        """YouTube가 아닌 도메인을 거부합니다."""
        assert not validate_youtube_url("https://www.google.com/watch?v=abc123")

    def test_vimeo_url(self) -> None:
        """Vimeo URL을 거부합니다."""
        assert not validate_youtube_url("https://vimeo.com/123456")

    def test_malformed_url(self) -> None:
        """잘못된 형식의 URL을 거부합니다."""
        assert not validate_youtube_url("not-a-url")

    def test_ftp_scheme(self) -> None:
        """FTP 스킴을 거부합니다."""
        assert not validate_youtube_url("ftp://www.youtube.com/watch?v=abc123")

    def test_youtube_without_video_id(self) -> None:
        """비디오 ID 없는 YouTube URL을 거부합니다."""
        assert not validate_youtube_url("https://www.youtube.com/watch")

    def test_youtube_homepage(self) -> None:
        """YouTube 홈페이지 URL을 거부합니다."""
        assert not validate_youtube_url("https://www.youtube.com/")

    def test_youtube_channel(self) -> None:
        """YouTube 채널 URL을 거부합니다."""
        assert not validate_youtube_url("https://www.youtube.com/channel/UCxyz")

    def test_youtu_be_without_id(self) -> None:
        """ID 없는 youtu.be URL을 거부합니다."""
        assert not validate_youtube_url("https://youtu.be/")

    def test_shorts_without_id(self) -> None:
        """ID 없는 shorts URL을 거부합니다."""
        assert not validate_youtube_url("https://www.youtube.com/shorts/")

    def test_javascript_protocol(self) -> None:
        """JavaScript 프로토콜을 거부합니다."""
        assert not validate_youtube_url("javascript:alert(1)")

    def test_data_uri(self) -> None:
        """Data URI를 거부합니다."""
        assert not validate_youtube_url("data:text/html,<h1>test</h1>")


class TestAllAllowedHosts:
    """모든 ALLOWED_HOSTS가 올바르게 검증되는지 테스트합니다."""

    def test_all_allowed_hosts_are_defined(self) -> None:
        """ALLOWED_HOSTS에 5개의 호스트가 정의되어 있는지 확인합니다."""
        expected_hosts = {
            "www.youtube.com",
            "youtube.com",
            "m.youtube.com",
            "youtu.be",
            "music.youtube.com",
        }
        assert ALLOWED_HOSTS == expected_hosts

    @pytest.mark.parametrize(
        "host",
        [
            "www.youtube.com",
            "youtube.com",
            "m.youtube.com",
            "music.youtube.com",
        ],
    )
    def test_watch_url_for_each_host(self, host: str) -> None:
        """각 호스트의 /watch URL이 유효한지 확인합니다."""
        url = f"https://{host}/watch?v=testid123"
        assert validate_youtube_url(url)

    def test_youtu_be_host(self) -> None:
        """youtu.be 호스트가 유효한지 확인합니다."""
        assert validate_youtube_url("https://youtu.be/testid123")
