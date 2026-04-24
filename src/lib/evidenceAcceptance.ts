import { evidenceParserFailureFixtures, type EvidenceParserFailureFixture } from '../fixtures/evidenceParserFailureFixtures'
import type { Agent, Project, Room, Task } from '../types'
import { resolveEvidenceMatch, type EvidenceMatchConfidence, type EvidenceMatchSource } from '../components/EvidenceObjectLinks'

export type EvidenceRowSource = 'tasks-board' | 'leads' | 'audit-log' | 'fixture'

export type EvidenceClassificationCategory = 'resolved' | 'missing_signals' | 'text_too_thin' | 'no_object_match'
export type EvidenceClassificationReason =
  | 'resolved'
  | 'signal_parts_empty'
  | 'text_under_min_length'
  | 'signals_present_but_unmapped'

export type EvidenceClassification = {
  category: EvidenceClassificationCategory
  reason: EvidenceClassificationReason
  success: boolean
  hitCount: number
  matchSource: EvidenceMatchSource
  matchConfidence: EvidenceMatchConfidence
}

export type EvidenceRowInput = {
  id: string
  source: EvidenceRowSource
  title: string
  detail: string
  timestamp: string
  textParts: string[]
  signalParts: string[]
}

export type EvidenceRow = EvidenceRowInput & EvidenceClassification

export const EVIDENCE_TEXT_MIN_LENGTH = 8

const normalize = (value?: string) => String(value ?? '').trim()
export const hasValue = (value?: string) => normalize(value).length > 0

export function classifyEvidenceRow({
  textParts,
  signalParts,
  hitCount,
  matchSource = hitCount > 0 ? 'signal_map_only' : 'none',
  matchConfidence = matchSource === 'direct_id'
    ? 'high'
    : matchSource === 'direct_name'
      ? 'medium'
      : matchSource === 'signal_map_account' || matchSource === 'signal_map_room' || matchSource === 'signal_map_content' || matchSource === 'signal_map_only'
        ? 'low'
        : 'none',
}: {
  textParts: string[]
  signalParts: string[]
  hitCount: number
  matchSource?: EvidenceMatchSource
  matchConfidence?: EvidenceMatchConfidence
}): EvidenceClassification {
  if (hitCount > 0 && (matchSource === 'direct_id' || matchSource === 'direct_name')) {
    return { category: 'resolved', reason: 'resolved', success: true, hitCount, matchSource, matchConfidence }
  }

  if (signalParts.length === 0) {
    return { category: 'missing_signals', reason: 'signal_parts_empty', success: false, hitCount, matchSource, matchConfidence }
  }

  if (textParts.join(' ').length < EVIDENCE_TEXT_MIN_LENGTH) {
    return { category: 'text_too_thin', reason: 'text_under_min_length', success: false, hitCount, matchSource, matchConfidence }
  }

  return { category: 'no_object_match', reason: 'signals_present_but_unmapped', success: false, hitCount, matchSource, matchConfidence }
}

export function buildEvidenceRow(
  input: EvidenceRowInput,
  data: { projects: Project[]; agents: Agent[]; rooms: Room[]; tasks: Task[] },
): EvidenceRow {
  const textParts = input.textParts.filter(hasValue)
  const signalParts = input.signalParts.filter(hasValue)
  const resolution = resolveEvidenceMatch({
    textParts,
    signalParts,
    projects: data.projects,
    agents: data.agents,
    rooms: data.rooms,
    tasks: data.tasks,
  })
  const hitCount = resolution.items.length
  const classification = classifyEvidenceRow({ textParts, signalParts, hitCount, matchSource: resolution.matchSource, matchConfidence: resolution.matchConfidence })
  return { ...input, textParts, signalParts, ...classification }
}

export function buildEvidenceParserFixtureDataset(data: { projects: Project[]; agents: Agent[]; rooms: Room[]; tasks: Task[] }) {
  return evidenceParserFailureFixtures.map((fixture) => ({
    fixture,
    row: buildEvidenceRow(
      {
        id: fixture.id,
        source: fixture.source,
        title: fixture.title,
        detail: fixture.detail,
        timestamp: 'fixture',
        textParts: fixture.textParts,
        signalParts: fixture.signalParts,
      },
      data,
    ),
  }))
}

export function summarizeFixtureDataset(dataset: Array<{ fixture: EvidenceParserFailureFixture; row: EvidenceRow }>) {
  return dataset.reduce<{ byCategory: Record<string, number>; byMatchSource: Record<string, number>; byMatchConfidence: Record<string, number> }>((acc, entry) => {
    const categoryKey = entry.row.category
    const sourceKey = entry.row.matchSource
    const confidenceKey = entry.row.matchConfidence
    acc.byCategory[categoryKey] = (acc.byCategory[categoryKey] ?? 0) + 1
    acc.byMatchSource[sourceKey] = (acc.byMatchSource[sourceKey] ?? 0) + 1
    acc.byMatchConfidence[confidenceKey] = (acc.byMatchConfidence[confidenceKey] ?? 0) + 1
    return acc
  }, { byCategory: {}, byMatchSource: {}, byMatchConfidence: {} })
}

export const HEURISTIC_DRIFT_SOURCES = ['signal_map_account', 'signal_map_room', 'signal_map_content', 'signal_map_only'] as const

export type HeuristicDriftSource = (typeof HEURISTIC_DRIFT_SOURCES)[number]

export type EvidenceDriftSample = {
  sampleId: string
  label: string
  timestamp?: string
  rows: EvidenceRow[]
}

export type EvidenceDriftBucketSummary = {
  source: HeuristicDriftSource
  counts: number[]
  ratios: number[]
  latestCount: number
  previousCount: number
  delta: number
  latestRatio: number
  previousRatio: number
  ratioDelta: number
  thresholdHit: boolean
  alertLevel: 'none' | 'watch' | 'warning' | 'critical'
  driftStartedAt?: string
}

export type EvidenceDriftAlert = {
  source: HeuristicDriftSource
  level: 'watch' | 'warning' | 'critical'
  latestCount: number
  delta: number
  latestRatio: number
  driftStartedAt?: string
  samples: Array<{ label: string; count: number; ratio: number }>
}

export type EvidenceDriftSummary = {
  samples: Array<{ sampleId: string; label: string; timestamp?: string; unresolved: number; heuristicHits: number }>
  buckets: EvidenceDriftBucketSummary[]
  alerts: EvidenceDriftAlert[]
  firstDriftSource?: HeuristicDriftSource
}

export function summarizeHeuristicDrift(rows: EvidenceRow[]) {
  const unresolved = rows.filter((row) => !row.success)
  const counts = HEURISTIC_DRIFT_SOURCES.reduce<Record<HeuristicDriftSource, number>>((acc, source) => {
    acc[source] = unresolved.filter((row) => row.matchSource === source).length
    return acc
  }, {
    signal_map_account: 0,
    signal_map_room: 0,
    signal_map_content: 0,
    signal_map_only: 0,
  })
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
  return { unresolvedCount: unresolved.length, heuristicHits: total, counts }
}

export function buildEvidenceDriftSummary(
  samples: EvidenceDriftSample[],
  options?: { countThreshold?: number; ratioThreshold?: number; criticalCountThreshold?: number; criticalRatioThreshold?: number },
): EvidenceDriftSummary {
  const countThreshold = options?.countThreshold ?? 2
  const ratioThreshold = options?.ratioThreshold ?? 0.25
  const criticalCountThreshold = options?.criticalCountThreshold ?? Math.max(3, countThreshold + 1)
  const criticalRatioThreshold = options?.criticalRatioThreshold ?? Math.max(0.5, ratioThreshold + 0.15)

  const sampleSummaries = samples.map((sample) => ({
    sampleId: sample.sampleId,
    label: sample.label,
    timestamp: sample.timestamp,
    ...summarizeHeuristicDrift(sample.rows),
  }))

  const buckets = HEURISTIC_DRIFT_SOURCES.map<EvidenceDriftBucketSummary>((source) => {
    const counts = sampleSummaries.map((sample) => sample.counts[source] ?? 0)
    const ratios = sampleSummaries.map((sample, index) => {
      const unresolvedCount = sample.unresolvedCount
      return unresolvedCount > 0 ? Number((counts[index] / unresolvedCount).toFixed(4)) : 0
    })
    const latestCount = counts.at(-1) ?? 0
    const previousCount = counts.at(-2) ?? 0
    const delta = latestCount - previousCount
    const latestRatio = ratios.at(-1) ?? 0
    const previousRatio = ratios.at(-2) ?? 0
    const ratioDelta = Number((latestRatio - previousRatio).toFixed(4))

    let driftStartedAt: string | undefined
    for (let index = 1; index < counts.length; index += 1) {
      const count = counts[index]
      const prevCount = counts[index - 1] ?? 0
      const ratio = ratios[index] ?? 0
      if (count > prevCount && (count >= countThreshold || ratio >= ratioThreshold)) {
        driftStartedAt = sampleSummaries[index]?.label
        break
      }
    }

    const thresholdHit = latestCount >= countThreshold || latestRatio >= ratioThreshold || delta >= 1
    const alertLevel: EvidenceDriftBucketSummary['alertLevel'] = latestCount >= criticalCountThreshold || latestRatio >= criticalRatioThreshold
      ? 'critical'
      : thresholdHit && (latestCount >= countThreshold || latestRatio >= ratioThreshold)
        ? 'warning'
        : delta > 0
          ? 'watch'
          : 'none'

    return {
      source,
      counts,
      ratios,
      latestCount,
      previousCount,
      delta,
      latestRatio,
      previousRatio,
      ratioDelta,
      thresholdHit,
      alertLevel,
      driftStartedAt,
    }
  })

  const alerts = buckets
    .filter((bucket) => bucket.alertLevel !== 'none')
    .sort((a, b) => {
      if ((b.delta ?? 0) !== (a.delta ?? 0)) return b.delta - a.delta
      if ((b.latestCount ?? 0) !== (a.latestCount ?? 0)) return b.latestCount - a.latestCount
      return HEURISTIC_DRIFT_SOURCES.indexOf(a.source) - HEURISTIC_DRIFT_SOURCES.indexOf(b.source)
    })
    .map<EvidenceDriftAlert>((bucket) => ({
      source: bucket.source,
      level: bucket.alertLevel === 'none' ? 'watch' : bucket.alertLevel,
      latestCount: bucket.latestCount,
      delta: bucket.delta,
      latestRatio: bucket.latestRatio,
      driftStartedAt: bucket.driftStartedAt,
      samples: sampleSummaries.map((sample, index) => ({
        label: sample.label,
        count: bucket.counts[index] ?? 0,
        ratio: bucket.ratios[index] ?? 0,
      })),
    }))

  const firstDriftSource = buckets
    .filter((bucket) => bucket.driftStartedAt)
    .sort((a, b) => {
      const aIndex = sampleSummaries.findIndex((sample) => sample.label === a.driftStartedAt)
      const bIndex = sampleSummaries.findIndex((sample) => sample.label === b.driftStartedAt)
      if (aIndex !== bIndex) return aIndex - bIndex
      return b.delta - a.delta
    })[0]?.source

  return {
    samples: sampleSummaries.map(({ sampleId, label, timestamp, unresolvedCount, heuristicHits }) => ({ sampleId, label, timestamp, unresolved: unresolvedCount, heuristicHits })),
    buckets,
    alerts,
    firstDriftSource,
  }
}
