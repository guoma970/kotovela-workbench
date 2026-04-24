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
  matchConfidence = matchSource === 'direct_id' ? 'high' : matchSource === 'direct_name' ? 'medium' : matchSource === 'signal_map_only' ? 'low' : 'none',
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
