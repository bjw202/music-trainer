import { formatTime } from '../../utils/timeUtils'

interface TimeDisplayProps {
  currentTime: number
  duration: number
}

/**
 * 시간 디스플레이 컴포넌트
 *
 * 현재 시간과 전체 시간을 mm:ss 형식으로 표시합니다.
 */
export function TimeDisplay({ currentTime, duration }: TimeDisplayProps) {
  return (
    <div data-testid="time-display" className="text-[#a0a0a0] text-sm font-mono">
      {formatTime(currentTime)} / {formatTime(duration)}
    </div>
  )
}
