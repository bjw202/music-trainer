/**
 * ABLoopManager - A-B 루프 관리
 *
 * 기능:
 * - A/B 루프 지점 설정
 * - 루프 활성화/비활성화
 * - 재생 위치 모니터링 및 루프백 트리거
 * - < 50ms 지연 목표
 *
 * 루프 동작:
 * - currentTime이 loopB에 도달하면 loopA로 되돌아감
 * - loopA < loopB 조건에서만 작동
 * - 지점이 null이면 루프 비활성화
 */

export class ABLoopManager {
  // A 지점 (초)
  private loopA: number | null = null

  // B 지점 (초)
  private loopB: number | null = null

  // 루프 활성화 여부
  private loopEnabled: boolean = false

  /**
   * A 지점 설정
   * @param time - A 지점 시간 (초), null으로 지정소
   */
  setLoopA(time: number | null): void {
    if (time === null) {
      this.loopA = null
      // 루프 비활성화 (지점 소실)
      this.loopEnabled = false
    } else {
      // 음수가 아닌 값 클랜핑
      this.loopA = Math.max(0, time)
    }

    // 유효성 검사: A >= B면 루프 비활성화
    this.validateLoop()
  }

  /**
   * B 지점 설정
   * @param time - B 지점 시간 (초), null으로 지점 소거
   */
  setLoopB(time: number | null): void {
    if (time === null) {
      this.loopB = null
      // 루프 비활성화 (지점 소실)
      this.loopEnabled = false
    } else {
      // 음수가 아닌 값 클랜핑
      this.loopB = Math.max(0, time)
    }

    // 유효성 검사: A >= B면 루프 비활성화
    this.validateLoop()
  }

  /**
   * 루프 활성화/비활성화
   * @param enabled - true면 활성화, false면 비활성화
   */
  enableLoop(enabled: boolean): void {
    if (!enabled) {
      this.loopEnabled = false
      return
    }

    // 두 지점이 모두 설정되어 있어야 활성화
    if (this.loopA !== null && this.loopB !== null) {
      // A < B 조건 검사
      if (this.loopA < this.loopB) {
        this.loopEnabled = true
      } else {
        // 유효하지 않은 루프
        this.loopEnabled = false
      }
    } else {
      // 지점 미설정
      this.loopEnabled = false
    }
  }

  /**
   * 루프 체크 및 트리거
   * currentTime이 loopB를 지났는지 확인하고 루프백을 트리거합니다.
   *
   * @param currentTime - 현재 재생 위치 (초)
   * @param seekCallback - 루프백 발생 시 호출할 콜백 (loopA로 이동)
   * @returns 루프가 트리거되었으면 true, 아니면 false
   */
  checkAndLoop(currentTime: number, seekCallback: (time: number) => void): boolean {
    // 루프 비활성화 상태면 무시
    if (!this.loopEnabled) {
      return false
    }

    // 지점 미설정 상태면 무시
    if (this.loopA === null || this.loopB === null) {
      return false
    }

    // 유효성 검사: A >= B면 루프 비활성화
    if (this.loopA >= this.loopB) {
      this.loopEnabled = false
      return false
    }

    // currentTime이 loopB를 지불었는지 확인
    // 약간의 오차 범위 (10ms)를 허용하여 연속 루프백 방지
    const tolerance = 0.01
    if (currentTime >= this.loopB - tolerance) {
      // 루프 트리거: loopA로 이동
      seekCallback(this.loopA)
      return true
    }

    return false
  }

  /**
   * A 지점 취득
   */
  getLoopA(): number | null {
    return this.loopA
  }

  /**
   * B 지점 취득
   */
  getLoopB(): number | null {
    return this.loopB
  }

  /**
   * 루프 활성화 여부 취득
   */
  getLoopEnabled(): boolean {
    return this.loopEnabled
  }

  /**
   * 루프 유효성 검사
   * A >= B이면 루프를 비활성화합니다.
   */
  private validateLoop(): void {
    if (this.loopA !== null && this.loopB !== null) {
      if (this.loopA >= this.loopB) {
        this.loopEnabled = false
      }
    }
  }

  /**
   * 모든 상태 초기화
   */
  reset(): void {
    this.loopA = null
    this.loopB = null
    this.loopEnabled = false
  }
}
