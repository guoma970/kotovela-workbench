export type EvidenceFixtureExpectation = {
  category: string
  success: boolean
  reason: string
  match_source: 'none' | 'direct_id' | 'direct_name' | 'signal_map_only'
  match_confidence: 'none' | 'low' | 'medium' | 'high'
}

export type EvidenceParserFailureFixture = {
  id: string
  title: string
  detail: string
  source: 'tasks-board' | 'leads' | 'audit-log' | 'fixture'
  textParts: string[]
  signalParts: string[]
  expectation: EvidenceFixtureExpectation
}

export const evidenceParserFailureFixtures: EvidenceParserFailureFixture[] = [
  {
    id: 'fixture-missing-structured-signals',
    title: 'missing structured signals',
    detail: 'decision log has text but no source/account/project identifiers',
    source: 'fixture',
    textParts: ['回执', 'notify_result', '规则命中但未写结构化字段'],
    signalParts: [],
    expectation: { category: 'missing_signals', success: false, reason: 'signal_parts_empty', match_source: 'none', match_confidence: 'none' },
  },
  {
    id: 'fixture-thin-title-only',
    title: 'thin title only',
    detail: 'single short token cannot drive parser matching',
    source: 'fixture',
    textParts: ['ok'],
    signalParts: ['manual'],
    expectation: { category: 'text_too_thin', success: false, reason: 'text_under_min_length', match_source: 'none', match_confidence: 'none' },
  },
  {
    id: 'fixture-thin-signal-only',
    title: 'thin signal only',
    detail: 'signal exists but descriptive text is too short to infer object',
    source: 'fixture',
    textParts: ['hi'],
    signalParts: ['manual_shadow'],
    expectation: { category: 'text_too_thin', success: false, reason: 'text_under_min_length', match_source: 'signal_map_only', match_confidence: 'low' },
  },
  {
    id: 'fixture-orphan-consultant',
    title: 'orphan consultant id',
    detail: 'consultant id captured but no project/room/task object can be matched',
    source: 'fixture',
    textParts: ['咨询顾问回执', 'consultant assigned', 'waiting followup shadow'],
    signalParts: ['consultant_id=consultant_shadow', 'source_line=unknown_channel'],
    expectation: { category: 'no_object_match', success: false, reason: 'signals_present_but_unmapped', match_source: 'signal_map_only', match_confidence: 'low' },
  },
  {
    id: 'fixture-unknown-account-line',
    title: 'unknown account line',
    detail: 'known parser shape but account/source not present in workbench graph',
    source: 'fixture',
    textParts: ['物料案例', 'route decision', 'account selected'],
    signalParts: ['account_line=ghost_official', 'source_line=ghost_room', 'content_line=material_case'],
    expectation: { category: 'no_object_match', success: false, reason: 'signals_present_but_unmapped', match_source: 'signal_map_only', match_confidence: 'low' },
  },
  {
    id: 'fixture-signal-map-only-hit',
    title: 'signal map only hit',
    detail: 'known signal map can produce object links without any direct id or name in text',
    source: 'fixture',
    textParts: ['route decision', 'auto handoff', 'parser fallback'],
    signalParts: ['account_line=yanfami_official', 'source_line=yanfami_official', 'content_line=material_case'],
    expectation: { category: 'no_object_match', success: false, reason: 'signals_present_but_unmapped', match_source: 'signal_map_only', match_confidence: 'low' },
  },
  {
    id: 'fixture-route-hit-success',
    title: 'valid route hit',
    detail: 'material case route should resolve to known objects',
    source: 'fixture',
    textParts: ['言町科技工作台', '岩板建材品牌案例', 'route decision'],
    signalParts: ['account_line=yanfami_official', 'source_line=yanfami_official', 'content_line=material_case'],
    expectation: { category: 'resolved', success: true, reason: 'resolved', match_source: 'direct_name', match_confidence: 'medium' },
  },
]
