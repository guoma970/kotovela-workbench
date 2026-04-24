import assert from 'node:assert/strict'
import { buildEvidenceDriftSummary, buildEvidenceParserFixtureDataset, classifyEvidenceRow, EVIDENCE_TEXT_MIN_LENGTH } from '../src/lib/evidenceAcceptance'
import type { Agent, Project, Room, Task } from '../src/types'

const projects: Project[] = [
  {
    id: 'project-1',
    code: 'PRJ-1',
    name: '言町科技工作台',
    owner: 'builder',
    ownerAgentId: 'agent-2',
    status: 'active',
    progress: 82,
    focus: 'evidence acceptance',
    blockers: 0,
    stage: 'delivery',
    nextStep: 'close parser fixtures',
    taskCount: 1,
    roomIds: ['room-2'],
  },
]

const agents: Agent[] = [
  {
    id: 'agent-2',
    code: 'AG-2',
    name: 'builder',
    role: 'builder',
    status: 'active',
    currentTask: 'DEV-74',
    project: '言町科技工作台',
    projectId: 'project-1',
    updatedAt: '2026-04-24T19:34:00+08:00',
    instanceKey: 'builder',
  },
]

const rooms: Room[] = [
  {
    id: 'room-2',
    code: 'ROOM-2',
    name: '言町科技运营群',
    status: 'active',
    focus: 'content routing',
    pending: 0,
    channelType: 'feishu',
    instance: 'builder',
    instanceIds: ['agent-2'],
    mainProject: '言町科技工作台',
    mainProjectId: 'project-1',
    purpose: 'route review',
    recentAction: 'parser triage',
  },
]

const tasks: Task[] = [
  {
    id: 'task-2',
    code: 'TASK-2',
    title: 'material case routing',
    project: '言町科技工作台',
    projectId: 'project-1',
    assignee: 'builder',
    assigneeAgentId: 'agent-2',
    executor: 'builder',
    executorAgentId: 'agent-2',
    status: 'doing',
    priority: 'high',
    updatedAt: '2026-04-24T19:34:00+08:00',
  },
]

const dataset = buildEvidenceParserFixtureDataset({ projects, agents, rooms, tasks })
assert.equal(dataset.length, 10, 'fixture dataset size should stay stable for regression checks')

for (const entry of dataset) {
  assert.equal(entry.row.category, entry.fixture.expectation.category, `${entry.fixture.id} category mismatch`)
  assert.equal(entry.row.reason, entry.fixture.expectation.reason, `${entry.fixture.id} reason mismatch`)
  assert.equal(entry.row.success, entry.fixture.expectation.success, `${entry.fixture.id} success mismatch`)
  assert.equal(entry.row.matchSource, entry.fixture.expectation.match_source, `${entry.fixture.id} match_source mismatch`)
  assert.equal(entry.row.matchConfidence, entry.fixture.expectation.match_confidence, `${entry.fixture.id} match_confidence mismatch`)
}

const shortTextClassification = classifyEvidenceRow({
  textParts: ['x'.repeat(EVIDENCE_TEXT_MIN_LENGTH - 1)],
  signalParts: ['builder'],
  hitCount: 0,
})
 assert.equal(shortTextClassification.matchSource, 'none')
 assert.equal(shortTextClassification.matchConfidence, 'none')
assert.equal(shortTextClassification.category, 'text_too_thin')
assert.equal(shortTextClassification.reason, 'text_under_min_length')

const noSignalClassification = classifyEvidenceRow({
  textParts: ['route decision'],
  signalParts: [],
  hitCount: 0,
})
assert.equal(noSignalClassification.category, 'missing_signals')
assert.equal(noSignalClassification.reason, 'signal_parts_empty')

const signalMapOnlyClassification = classifyEvidenceRow({
  textParts: ['route decision', 'auto handoff'],
  signalParts: ['account_line=yanfami_official'],
  hitCount: 2,
  matchSource: 'signal_map_account',
  matchConfidence: 'low',
})
assert.equal(signalMapOnlyClassification.category, 'no_object_match')
assert.equal(signalMapOnlyClassification.success, false)
assert.equal(signalMapOnlyClassification.matchSource, 'signal_map_account')

const driftSummary = buildEvidenceDriftSummary([
  {
    sampleId: 'round-1',
    label: 'round-1',
    rows: [
      { ...dataset[0].row, id: 'drift-row-1', success: false, category: 'no_object_match', reason: 'signals_present_but_unmapped', matchSource: 'signal_map_room', matchConfidence: 'low', structuredSplitSource: 'signal_map_room' },
    ],
  },
  {
    sampleId: 'round-2',
    label: 'round-2',
    rows: [
      { ...dataset[0].row, id: 'drift-row-2', success: false, category: 'no_object_match', reason: 'signals_present_but_unmapped', matchSource: 'signal_map_account', matchConfidence: 'low', structuredSplitSource: 'signal_map_account' },
      { ...dataset[1].row, id: 'drift-row-3', success: false, category: 'no_object_match', reason: 'signals_present_but_unmapped', matchSource: 'signal_map_account', matchConfidence: 'low', structuredSplitSource: 'signal_map_account' },
      { ...dataset[2].row, id: 'drift-row-4', success: false, category: 'no_object_match', reason: 'signals_present_but_unmapped', matchSource: 'signal_map_room', matchConfidence: 'low', structuredSplitSource: 'signal_map_room' },
    ],
  },
])
assert.equal(driftSummary.buckets.find((bucket) => bucket.source === 'signal_map_account')?.alertLevel, 'critical')
assert.equal(driftSummary.firstDriftSource, 'signal_map_room')

console.log(JSON.stringify({
  total: dataset.length,
  categories: dataset.map((entry) => ({ id: entry.fixture.id, category: entry.row.category, reason: entry.row.reason, match_source: entry.row.matchSource, match_confidence: entry.row.matchConfidence })),
}, null, 2))
