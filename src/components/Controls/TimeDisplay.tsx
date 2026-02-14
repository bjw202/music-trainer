import { formatTime } from '../../utils/timeUtils'

interface TimeDisplayProps {
  currentTime: number
  duration: number
  isCurrentTime?: boolean
}

/**
 * 시간 디스플레이 컴포넌트
 *
 * 현재 시간과 전체 시간을 mm:ss 형식으로 표시합니다.
 */
export function TimeDisplay({ currentTime, duration, isCurrentTime = true }: TimeDisplayProps) {
  return (
    <div
      data-testid="time-display"
      className={`text-[13px] font-mono ${isCurrentTime ? 'text-[#F5F5F5]' : 'text-[#6B7280]'}`}
    >
      {formatTime(isCurrentTime ? currentTime : duration)}
    </div>
  )
}
