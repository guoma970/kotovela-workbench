import { evidenceParserFailureFixtures, type EvidenceParserFailureFixture } from '../fixtures/evidenceParserFailureFixtures'
import type { Agent, Project, Room, Task } from '../types'
import { resolveEvidenceObjects } from '../components/EvidenceObjectLinks'

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
  hasDirectMatch = hitCount > 0,
}: {
  textParts: string[]
  signalParts: string[]
  hitCount: number
  hasDirectMatch?: boolean
}): EvidenceClassification {
  if (hitCount > 0 && hasDirectMatch) {
    return { category: 'resolved', reason: 'resolved', success: true, hitCount }
  }


  if (signalParts.length === 0) {
    return { category: 'missing_signals', reason: 'signal_parts_empty', success: false, hitCount }
  }

  if (textParts.join(' ').length < EVIDENCE_TEXT_MIN_LENGTH) {
    return { category: 'text_too_thin', reason: 'text_under_min_length', success: false, hitCount }
  }

  return { category: 'no_object_match', reason: 'signals_present_but_unmapped', success: false, hitCount }
}

const normalizedIncludes = (haystack: string, needle: string) => haystack.includes(needle)

function hasDirectEvidenceMatch(
  textParts: string[],
  signalParts: string[],
  data: { projects: Project[]; agents: Agent[]; rooms: Room[]; tasks: Task[] },
) {
  const all = [...textParts, ...signalParts].map((item) => normalize(item).toLowerCase()).filter(Boolean)
  const candidates = [
    ...data.projects.flatMap((item) => [item.id, item.code, item.name]),
    ...data.agents.flatMap((item) => [item.id, item.code, item.name, item.instanceKey ?? '']),
    ...data.rooms.flatMap((item) => [item.id, item.code, item.name]),
    ...data.tasks.flatMap((item) => [item.id, item.code, item.title]),
  ]
    .map((item) => normalize(item).toLowerCase())
    .filter(Boolean)

  return all.some((part) => candidates.some((candidate) => normalizedIncludes(part, candidate) || normalizedIncludes(candidate, part)))
}

export function buildEvidenceRow(
  input: EvidenceRowInput,
  data: { projects: Project[]; agents: Agent[]; rooms: Room[]; tasks: Task[] },
): EvidenceRow {
  const textParts = input.textParts.filter(hasValue)
  const signalParts = input.signalParts.filter(hasValue)
  const hitCount = resolveEvidenceObjects({
    textParts,
    signalParts,
    projects: data.projects,
    agents: data.agents,
    rooms: data.rooms,
    tasks: data.tasks,
  }).length
  const classification = classifyEvidenceRow({ textParts, signalParts, hitCount, hasDirectMatch: hasDirectEvidenceMatch(textParts, signalParts, data) })
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
  return dataset.reduce<Record<string, number>>((acc, entry) => {
    const key = entry.row.category
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}
