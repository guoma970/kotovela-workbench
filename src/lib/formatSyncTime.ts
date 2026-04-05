/** 展示 OpenClaw 最近一次成功拉取完成的时间（本地时区）。 */
export function formatLastSyncedAt(ms: number | null): string {
  if (ms == null) return '尚未成功同步'
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
