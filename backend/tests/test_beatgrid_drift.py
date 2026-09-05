"""드리프트 측정 스크립트(`scripts/measure_beatgrid_drift.py`) 테스트.

SPEC-BPM-003 REQ-BPM-005 / AC-BPM-005 / plan.md M3.

케이스 구성 (plan.md M3):
  DDD 코어 (원본 동작의 이식 검증) : 1, 2, 5, 6, 7
  TDD 신규 CLI 계약               : 3, 4, 8, 9
  PRESERVE 골든 대조              : test_ported_matches_original_golden_from_arrays

DDD/TDD 케이스는 합성 입력만 사용하므로 madmom·오디오 없이 결정론적으로 돈다.
골든 대조 테스트도 M5 이전에 캡처해 둔 고정 배열 픽스처를 쓰므로 madmom·오디오를
필요로 하지 않는다 (아래 PRESERVE 절 참고).
"""

from __future__ import annotations

import io
import json
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT / "scripts"))

import measure_beatgrid_drift as mbd  # noqa: E402


# ---------------------------------------------------------------------------
# 합성 입력 헬퍼
# ---------------------------------------------------------------------------

def _grid(n: int = 40, interval: float = 0.5, start: float = 0.5) -> list[float]:
    """등간격 비트 그리드를 만든다."""
    return [round(start + i * interval, 3) for i in range(n)]


def _fake_provider(
    emitted: list[float],
    detector: list[float],
    *,
    engine: str = "madmom",
    service_inserted: int = 0,
    service_dropped: int = 0,
    calls: list[str] | None = None,
):
    """합성 측정 입력을 돌려주는 provider. 호출 여부를 `calls`에 기록한다."""

    def provider(audio_path, *, use_cache, need_repair_counts):  # noqa: ARG001
        if calls is not None:
            calls.append("called")
        return mbd.DriftInput(
            emitted=list(emitted),
            detector=list(detector),
            engine=engine,
            service_inserted=service_inserted,
            service_dropped=service_dropped,
        )

    return provider


def _run(argv: list[str], provider) -> tuple[int, str, str]:
    """main()을 실행하고 (exit_code, stdout, stderr)를 돌려준다."""
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        code = mbd.main(argv, provider=provider)
    return code, out.getvalue(), err.getvalue()


# ---------------------------------------------------------------------------
# TDD 케이스 3 — `--json` 출력 계약 (신규 CLI 표면)
# ---------------------------------------------------------------------------

CONTRACT_KEYS = {
    "max_drift_ms",
    "last_beat_drift_ms",
    "mean_drift_ms",
    "beat_count",
    "matched_count",
    "inserted_count",
    "dropped_count",
    "engine",
    "service_inserted",
    "service_dropped",
}


def test_case3_json_output_contains_contract_keys(tmp_path: Path) -> None:
    """케이스 3: `--json`은 stdout에 유효한 JSON 하나만 내고 계약 키를 모두 포함한다."""
    audio = tmp_path / "fake.mp3"
    audio.write_bytes(b"stub")
    beats = _grid()

    code, out, _err = _run(
        [str(audio), "--json"],
        _fake_provider(beats, beats),
    )

    assert code == 0
    payload = json.loads(out)  # stdout 오염이 있으면 여기서 깨진다
    assert CONTRACT_KEYS <= payload.keys(), f"missing: {CONTRACT_KEYS - payload.keys()}"
    assert payload["engine"] == "madmom"


def test_case3_exit_1_when_threshold_exceeded(tmp_path: Path) -> None:
    """케이스 3(계약 일부): 감지기 유래 max_drift_ms가 임계를 넘으면 exit 1."""
    audio = tmp_path / "fake.mp3"
    audio.write_bytes(b"stub")
    detector = _grid()
    # 전 비트를 2ms 밀어 둔다 — tolerance(5.0ms) 안이라 '감지기 유래'로 남고,
    # threshold(1.0ms)는 넘긴다.
    emitted = [round(b + 0.002, 6) for b in detector]

    code, out, _err = _run(
        [str(audio), "--json"],
        _fake_provider(emitted, detector),
    )

    assert code == 1
    payload = json.loads(out)
    assert payload["max_drift_ms"] == pytest.approx(2.0, abs=0.01)
    assert payload["inserted_count"] == 0


def test_case3_inserted_beats_do_not_affect_exit_code(tmp_path: Path) -> None:
    """케이스 3(계약 일부): `inserted_count`는 exit code에 영향을 주지 않는다."""
    audio = tmp_path / "fake.mp3"
    audio.write_bytes(b"stub")
    detector = _grid()
    emitted = sorted(detector + [round(detector[10] + 0.25, 3)])

    code, out, _err = _run(
        [str(audio), "--json"],
        _fake_provider(emitted, detector, service_inserted=1),
    )

    assert code == 0
    payload = json.loads(out)
    assert payload["inserted_count"] == 1


# ---------------------------------------------------------------------------
# TDD 케이스 4 — 오류 경로
# ---------------------------------------------------------------------------

def test_case4_missing_input_file_exits_nonzero_with_clean_stdout() -> None:
    """케이스 4: 존재하지 않는 경로 → 0이 아닌 exit, stderr 메시지, stdout 비어 있음."""
    calls: list[str] = []
    code, out, err = _run(
        ["/nonexistent/file.mp3", "--json"],
        _fake_provider([], [], calls=calls),
    )

    assert code != 0
    assert out == "", f"stdout must stay empty, got: {out!r}"
    assert err.strip() != ""
    assert calls == [], "존재하지 않는 입력에 대해 측정을 시작해서는 안 된다"


# ---------------------------------------------------------------------------
# TDD 케이스 8 — MATCH_TOLERANCE_MS > threshold_ms 불변식 (N1 방어선)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("threshold", ["5.0", "9.0"])
def test_case8_tolerance_invariant_aborts_before_measuring(
    tmp_path: Path, threshold: str
) -> None:
    """케이스 8: threshold ≥ MATCH_TOLERANCE_MS면 측정하지 않고 중단한다."""
    audio = tmp_path / "fake.mp3"
    audio.write_bytes(b"stub")
    beats = _grid()
    calls: list[str] = []

    code, out, err = _run(
        [str(audio), "--json", "--threshold-ms", threshold],
        _fake_provider(beats, beats, calls=calls),
    )

    assert code != 0
    assert calls == [], "불변식 위반 시 측정을 시작해서는 안 된다"
    assert out == "", f"stdout must stay empty, got: {out!r}"
    assert "MATCH_TOLERANCE_MS" in err


def test_case8_default_threshold_satisfies_invariant(tmp_path: Path) -> None:
    """케이스 8(대조군): 기본 조합(5.0 > 1.0)은 불변식을 만족해 정상 측정된다."""
    audio = tmp_path / "fake.mp3"
    audio.write_bytes(b"stub")
    beats = _grid()
    calls: list[str] = []

    code, _out, _err = _run([str(audio), "--json"], _fake_provider(beats, beats, calls=calls))

    assert code == 0
    assert calls == ["called"]


# ---------------------------------------------------------------------------
# TDD 케이스 9 — 서비스 보고 건수와의 자기 대조 (N2 방어선)
# ---------------------------------------------------------------------------

def test_case9_cross_check_mismatch_reports_then_exits_nonzero(tmp_path: Path) -> None:
    """케이스 9: 분류 건수 ≠ 서비스 보고 건수 → 측정값은 내되 0이 아닌 exit."""
    audio = tmp_path / "fake.mp3"
    audio.write_bytes(b"stub")
    detector = _grid()
    emitted = sorted(detector + [round(detector[10] + 0.25, 3)])  # 스크립트 분류: inserted 1

    code, out, err = _run(
        [str(audio), "--json"],
        _fake_provider(emitted, detector, service_inserted=0),  # 서비스는 0을 보고
    )

    assert code != 0
    payload = json.loads(out)  # 측정값은 출력한다
    assert payload["inserted_count"] == 1
    assert payload["service_inserted"] == 0
    assert "service_inserted" in err


def test_case9_cross_check_agreement_passes(tmp_path: Path) -> None:
    """케이스 9(대조군): 두 건수가 일치하면 대조를 통과한다."""
    audio = tmp_path / "fake.mp3"
    audio.write_bytes(b"stub")
    detector = _grid()
    emitted = sorted(detector[:-1] + [round(detector[10] + 0.25, 3)])

    code, out, _err = _run(
        [str(audio), "--json"],
        _fake_provider(emitted, detector, service_inserted=1, service_dropped=1),
    )

    assert code == 0
    payload = json.loads(out)
    assert payload["inserted_count"] == 1
    assert payload["dropped_count"] == 1


def test_case9_missing_service_interface_fails_loudly(tmp_path: Path) -> None:
    """케이스 9(선행): 서비스가 보정 건수를 노출하지 않으면 측정하지 않고 중단한다.

    `_repair_beats`(M2)가 아직 없는 현 시점의 실제 상태다. 0으로 기본값을 넣으면
    대조가 아무것도 비교하지 않으면서 통과하므로, 없는 상태는 소리 내어 실패해야 한다.
    """
    audio = tmp_path / "fake.mp3"
    audio.write_bytes(b"stub")

    def provider(audio_path, *, use_cache, need_repair_counts):  # noqa: ARG001
        raise mbd.MissingRepairCountsError(
            "BpmResult.repair_counts 가 없다 (_repair_beats 미구현)"
        )

    code, out, err = _run([str(audio), "--json"], provider)

    assert code != 0
    assert out == ""
    assert "repair_counts" in err


# ---------------------------------------------------------------------------
# DDD 코어 케이스 1 — 방출 그리드 == 감지기 출력
# ---------------------------------------------------------------------------

def test_case1_identical_grids_have_zero_drift() -> None:
    """케이스 1: 방출 그리드가 감지기 출력과 같으면 드리프트도 보정도 0이다."""
    beats = _grid()
    stats = mbd.measure_nearest_match(beats, beats)

    assert stats["max_drift_ms"] == 0.0
    assert stats["last_beat_drift_ms"] == 0.0
    assert stats["mean_drift_ms"] == 0.0
    assert stats["inserted_count"] == 0
    assert stats["dropped_count"] == 0
    assert stats["matched_count"] == stats["beat_count"] == len(beats)


# ---------------------------------------------------------------------------
# DDD 코어 케이스 2 — 누적 드리프트 (변경 전 코드가 만드는 모양)
# ---------------------------------------------------------------------------

def _drifting_grid(detector: list[float], total_drift_s: float = 0.64) -> list[float]:
    """마지막 비트에서 `total_drift_s`만큼 밀리도록 선형 누적 드리프트를 준다."""
    n = len(detector)
    return [round(b + total_drift_s * i / (n - 1), 6) for i, b in enumerate(detector)]


def test_case2_accumulated_drift_measured_by_legacy_index_diff() -> None:
    """케이스 2: 마지막에서 0.64초 밀린 그리드 → last ≈ 640ms, max ≥ 100ms.

    이 값은 **인덱스 정렬 차분**(원본 계산 방식)에서 나온다. 변경 전 코드의 평활화는
    비트 개수를 바꾸지 않으므로 인덱스 대응이 성립하며, 사전 기준선이 재는 것도
    바로 이 양이다.
    """
    detector = _grid()
    emitted = _drifting_grid(detector)

    stats = mbd.measure_legacy_index_diff(emitted, detector)

    assert stats["last_beat_drift_ms"] == pytest.approx(640.0, abs=0.5)
    assert stats["max_drift_ms"] >= 100.0
    assert stats["beat_count"] == len(detector)


def test_case2_drifted_beats_are_reclassified_as_inserted_by_nearest_match() -> None:
    """케이스 2(대응 확인): 같은 입력을 최근접 대응으로 보면 드리프트가 통계에서 빠진다.

    tolerance(5.0ms)를 넘어선 비트는 최근접 감지기 비트와 만나지 못해 "삽입"으로
    분류되고 `max_drift_ms`에서 제외된다 — spec.md의 N1이 지목한 바로 그 성질이다.
    따라서 누적 드리프트를 재려면 `--legacy-index-diff`를 써야 하며, 이 테스트는
    두 모드가 서로 다른 질문에 답한다는 사실 자체를 고정한다.
    """
    detector = _grid()
    emitted = _drifting_grid(detector)

    stats = mbd.measure_nearest_match(emitted, detector)

    assert stats["max_drift_ms"] <= mbd.MATCH_TOLERANCE_MS
    assert stats["inserted_count"] > 0


# ---------------------------------------------------------------------------
# DDD 코어 케이스 5 — APP_DIR 없이도 리포 루트를 찾는다 (정규화 (a))
# ---------------------------------------------------------------------------

def test_case5_repo_root_resolves_without_app_dir(monkeypatch: pytest.MonkeyPatch) -> None:
    """케이스 5: `APP_DIR` 환경 변수 없이도 리포 루트를 유도한다."""
    monkeypatch.delenv("APP_DIR", raising=False)

    root = mbd.repo_root()

    assert root == _REPO_ROOT
    assert (root / "backend" / "app" / "services" / "bpm_service.py").is_file()
    assert (root / "scripts" / "measure_beatgrid_drift.py").is_file()


# ---------------------------------------------------------------------------
# DDD 코어 케이스 6 — 삽입 비트는 드리프트 통계로 새어 들어오지 않는다 (감사 D2)
# ---------------------------------------------------------------------------

def test_case6_inserted_beat_excluded_from_drift_statistics() -> None:
    """케이스 6: 누락 구간 중앙에 삽입된 비트 1개 → max_drift ≤ 0.5ms, inserted 1."""
    detector = _grid()
    gap_start = detector[10]
    inserted = round(gap_start + 0.25, 3)  # 박 간격(0.5s)의 절반 지점
    emitted = sorted(detector + [inserted])

    stats = mbd.measure_nearest_match(emitted, detector)

    assert stats["inserted_count"] == 1
    assert stats["dropped_count"] == 0
    assert stats["max_drift_ms"] <= 0.5
    assert stats["matched_count"] == len(detector)
    assert stats["beat_count"] == len(detector) + 1


# ---------------------------------------------------------------------------
# DDD 코어 케이스 7 — 제거된 비트는 건수로만 보고된다
# ---------------------------------------------------------------------------

def test_case7_dropped_beat_reported_without_affecting_drift() -> None:
    """케이스 7: 감지기 출력에서 1개 제거 → dropped_count 1, 드리프트는 그대로."""
    detector = _grid()
    emitted = detector[:10] + detector[11:]

    stats = mbd.measure_nearest_match(emitted, detector)

    assert stats["dropped_count"] == 1
    assert stats["inserted_count"] == 0
    assert stats["max_drift_ms"] == 0.0
    assert stats["beat_count"] == len(detector) - 1


# ---------------------------------------------------------------------------
# PRESERVE — 골든 픽스처 대조 (고정 배열, madmom·오디오 불필요)
# ---------------------------------------------------------------------------

# 원본 1회 실행의 측정값과 허용 오차 (M3에서 기록, 변경 금지).
_GOLDEN_PATH = Path(__file__).resolve().parent / "fixtures" / "drift_baseline_smoke_on_the_water.json"

# 그 측정의 입력이 된 두 배열 (M5 직전 캡처).
_GOLDEN_ARRAYS_PATH = (
    Path(__file__).resolve().parent / "fixtures" / "drift_golden_arrays_smoke_on_the_water.json"
)


def test_ported_matches_original_golden_from_arrays() -> None:
    """포팅본이 원본 계산 방식으로 골든 값을 재현하는지 고정 배열로 판정한다.

    입력은 M5(`_smooth_beats` 삭제) 직전에 1회 캡처한 두 배열이다.

      detector       — 감지기 원본 출력 (madmom RNN + DBN, 비반올림)
      emitted_before — 변경 전 서비스가 실제로 방출하던 그리드
                       (`_smooth_beats` 적용 후 소수점 3자리 반올림)

    측정 대상은 순수 함수 `measure_legacy_index_diff` 하나이며, 배열이 고정되어
    있으므로 madmom·오디오 파일·서비스 코드 어느 것에도 의존하지 않는다. 이 테스트가
    답하는 질문은 "이식이 측정값을 바꾸었는가"이고, 그 질문의 입력은 변경 전 코드에만
    존재했으므로 배열로 박제하는 것 말고는 보존할 방법이 없다.

    허용 오차는 골든 픽스처에 미리 못 박혀 있다. 초과하면 실패이며,
    "원인을 적으면 통과" 조항은 없다.
    """
    golden = json.loads(_GOLDEN_PATH.read_text())
    arrays = json.loads(_GOLDEN_ARRAYS_PATH.read_text())

    # 두 픽스처가 같은 오디오를 가리키는지 먼저 못 박는다.
    assert arrays["fixture_audio"] == golden["fixture_audio"]

    emitted = arrays["emitted_before"]
    detector = arrays["detector"]
    assert len(emitted) == len(detector) == arrays["beat_count"]

    stats = mbd.measure_legacy_index_diff(emitted, detector)
    tol = golden["tolerances"]

    assert stats["beat_count"] == golden["beat_count"]
    assert stats["max_drift_ms"] == pytest.approx(
        golden["max_drift_ms"], abs=tol["max_drift_ms"]
    )
    assert stats["last_beat_drift_ms"] == pytest.approx(
        golden["last_beat_drift_ms"], abs=tol["last_beat_drift_ms"]
    )
