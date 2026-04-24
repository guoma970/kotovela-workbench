export type StructuredSignalBucket = 'signal_map_account' | 'signal_map_room' | 'signal_map_content'

const normalize = (value?: string) => String(value ?? '').trim().toLowerCase()

function readSignalValue(signalParts: string[], key: 'account_line' | 'source_line' | 'content_line') {
  const prefix = `${key}=`
  const hit = signalParts.map((part) => normalize(part)).find((part) => part.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

export function inferStructuredSignalBucket(signalParts: string[]): StructuredSignalBucket | undefined {
  const normalized = signalParts.map((part) => normalize(part)).filter(Boolean)
  const accountLine = readSignalValue(normalized, 'account_line')
  const sourceLine = readSignalValue(normalized, 'source_line')
  const contentLine = readSignalValue(normalized, 'content_line')

  if (accountLine && sourceLine && sourceLine !== accountLine) return 'signal_map_room'
  if (contentLine && (!accountLine || !sourceLine || contentLine !== sourceLine)) return 'signal_map_content'
  if (accountLine) return 'signal_map_account'
  if (sourceLine) return 'signal_map_room'
  if (contentLine) return 'signal_map_content'
  return undefined
}
