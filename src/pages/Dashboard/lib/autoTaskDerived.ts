import type {
  ArchiveCenterEntry,
  AutoTaskBoardItem,
  AutoTaskBoardPayload,
  PublishCenterEntry,
  TaskNotificationItem,
} from '../components/DashboardAutoTaskPanel'

type NotificationDomain = 'builder' | 'media' | 'family' | 'business'

const DONE_TASK_STATUSES = ['done', 'success', 'cancelled'] as const

function normalizeAssetType(item: AutoTaskBoardItem): PublishCenterEntry['assetType'] {
  if (item.result?.asset_type) return item.result.asset_type
  if (item.domain === 'media') return 'media'
  if (item.domain === 'business') return 'business'
  if (item.domain === 'family') return 'family'
  return 'generic'
}

function buildPublishCenterEntries(board: AutoTaskBoardItem[]): PublishCenterEntry[] {
  return board
    .filter((item) => item.result && DONE_TASK_STATUSES.includes(item.status as (typeof DONE_TASK_STATUSES)[number]) && item.result.publish_ready !== false)
    .map((item) => ({
      taskName: item.task_name,
      domain: item.domain ?? 'unknown',
      assetType: normalizeAssetType(item),
      updatedAt: item.updated_at ?? item.timestamp,
      source: item.source,
      roleVersion: item.role_version,
      brandLine: item.brand_line,
      brandDisplay: item.brand_display,
      mcnDisplay: item.mcn_display,
      contentLine: item.content_line,
      accountLine: item.account_line,
      accountDisplay: item.account_display,
      accountType: item.account_type,
      tier: item.tier,
      routeResult: item.route_result,
      routeTarget: item.route_target,
      canCloseDeal: item.can_close_deal,
      distributionChannel: item.distribution_channel,
      contentVariant: item.content_variant,
      sourceLine: item.source_line,
      result: {
        ...item.result!,
        asset_type: normalizeAssetType(item),
      },
    }))
}

function buildArchiveCenterEntries(board: AutoTaskBoardItem[]): ArchiveCenterEntry[] {
  return board
    .filter((item) => item.result && DONE_TASK_STATUSES.includes(item.status as (typeof DONE_TASK_STATUSES)[number]) && item.result.archive_ready !== false)
    .map((item) => ({
      taskName: item.task_name,
      domain: item.domain ?? 'unknown',
      assetType: normalizeAssetType(item),
      updatedAt: item.updated_at ?? item.timestamp,
      source: item.source,
      roleVersion: item.role_version,
      brandLine: item.brand_line,
      brandDisplay: item.brand_display,
      mcnDisplay: item.mcn_display,
      contentLine: item.content_line,
      accountLine: item.account_line,
      accountDisplay: item.account_display,
      accountType: item.account_type,
      tier: item.tier,
      routeResult: item.route_result,
      routeTarget: item.route_target,
      canCloseDeal: item.can_close_deal,
      distributionChannel: item.distribution_channel,
      contentVariant: item.content_variant,
      sourceLine: item.source_line,
      result: item.result!,
    }))
}

export function deriveAutoTaskViewData({
  data,
  notifications,
  sortedBoard,
  humanPendingTasks,
  poolBoard,
  runningTasks,
  queuedTasks,
  activeNoticeDomain,
}: {
  data: AutoTaskBoardPayload | null
  notifications: TaskNotificationItem[]
  sortedBoard: AutoTaskBoardItem[]
  humanPendingTasks: AutoTaskBoardItem[]
  poolBoard: AutoTaskBoardItem[]
  runningTasks: AutoTaskBoardItem[]
  queuedTasks: AutoTaskBoardItem[]
  activeNoticeDomain: NotificationDomain
}) {
  const recentDecisions = [...(data?.board ?? [])]
    .flatMap((item) =>
      (item.decision_log ?? []).map((entry) => ({
        taskName: item.task_name,
        agent: item.agent,
        decision: entry.action,
        reason: entry.reason,
        detail: entry.detail,
        timestamp: entry.timestamp,
        retryCount: item.retry_count ?? 0,
      })),
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8)

  const routingDecisionTable = Array.from(
    sortedBoard.reduce((map, item) => {
      const key = [
        item.content_line ?? '-',
        item.brand_line ?? '-',
        item.account_line ?? '-',
        item.account_type ?? '-',
        item.tier ?? '-',
        String(item.can_close_deal ?? '-'),
        item.route_target ?? '-',
      ].join('|')
      if (!map.has(key)) {
        map.set(key, {
          key,
          content_line: item.content_line ?? '-',
          brand_line: item.brand_line ?? '-',
          account_line: item.account_line ?? '-',
          account_type: item.account_type ?? '-',
          tier: item.tier ?? '-',
          can_close_deal: typeof item.can_close_deal === 'boolean' ? String(item.can_close_deal) : '-',
          route_target: item.route_target ?? '-',
          count: 0,
        })
      }
      map.get(key)!.count += 1
      return map
    }, new Map<string, { key: string; content_line: string; brand_line: string; account_line: string; account_type: string; tier: string; can_close_deal: string; route_target: string; count: number }>()),
  ).map(([, value]) => value)

  const routeFocusedTasks = sortedBoard.filter((item) => item.route_target || item.content_line || item.account_line)
  const recentResults = data?.recent_results ?? []

  const publishCenterEntries = buildPublishCenterEntries(sortedBoard)
  const archiveCenterEntries = buildArchiveCenterEntries(sortedBoard)

  const archiveDomainGroups = Array.from(
    archiveCenterEntries.reduce((map, entry) => {
      const list = map.get(entry.domain) ?? []
      list.push(entry)
      map.set(entry.domain, list)
      return map
    }, new Map<string, ArchiveCenterEntry[]>()),
  ).sort((a, b) => b[1].length - a[1].length)

  const archiveContentLineGroups = Array.from(
    archiveCenterEntries.reduce((map, entry) => {
      const key = entry.contentLine ?? 'unknown'
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
      return map
    }, new Map<string, ArchiveCenterEntry[]>()),
  ).sort((a, b) => b[1].length - a[1].length)

  const archiveAccountLineGroups = Array.from(
    archiveCenterEntries.reduce((map, entry) => {
      const key = entry.accountLine ?? 'unknown'
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
      return map
    }, new Map<string, ArchiveCenterEntry[]>()),
  ).sort((a, b) => b[1].length - a[1].length)

  const publishSourceGroups = Array.from(
    publishCenterEntries.reduce((map, entry) => {
      const key = entry.source?.title || entry.source?.chapter_title || entry.taskName.split(' · ')[0]
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list.sort((a) => (a.contentVariant === 'short' ? -1 : 1)))
      return map
    }, new Map<string, PublishCenterEntry[]>()),
  )

  const currentProfile = data?.current_profile

  const archiveStructureGroups = Array.from(
    archiveCenterEntries.reduce((map, entry) => {
      const key = entry.result.structure_id ?? 'unknown'
      const current = map.get(key) ?? { structureId: key, count: 0, accounts: new Map<string, number>() }
      current.count += 1
      const accountKey = entry.accountDisplay || entry.accountLine || 'unknown'
      current.accounts.set(accountKey, (current.accounts.get(accountKey) ?? 0) + 1)
      map.set(key, current)
      return map
    }, new Map<string, { structureId: string; count: number; accounts: Map<string, number> }>()),
  )
    .map(([, value]) => ({
      structureId: value.structureId,
      count: value.count,
      topAccount: [...value.accounts.entries()].sort((a, b) => b[1] - a[1])[0],
    }))
    .sort((a, b) => b.count - a.count)

  const todayAutoGeneratedTasks = sortedBoard.filter((item) => item.auto_generated)
  const riskSummary = {
    predictedHigh: sortedBoard.filter((item) => item.predicted_risk === 'high').length,
    needHuman: humanPendingTasks.length,
    blocked: sortedBoard.filter((item) => item.status === 'blocked' || (item.blocked_by?.length ?? 0) > 0 || item.predicted_block).length,
    externalBlocked: sortedBoard.filter((item) => item.account_type === 'external_partner' && item.route_result === 'blocked').length,
    leadTransferred: sortedBoard.filter((item) => item.account_type === 'external_partner' && item.route_result === 'transfer').length,
  }

  const domainLoadSummaryMap = new Map<string, { domain: string; total: number; running: number; queued: number; needHuman: number; blocked: number }>()
  sortedBoard.forEach((item) => {
    const key = item.domain ?? 'unknown'
    const current = domainLoadSummaryMap.get(key) ?? { domain: key, total: 0, running: 0, queued: 0, needHuman: 0, blocked: 0 }
    current.total += 1
    if (['doing', 'running'].includes(item.status)) current.running += 1
    if (['todo', 'queued', 'queue', 'pending', 'preparing'].includes(item.status)) current.queued += 1
    if (item.need_human) current.needHuman += 1
    if (item.status === 'blocked' || (item.blocked_by?.length ?? 0) > 0 || item.predicted_block) current.blocked += 1
    domainLoadSummaryMap.set(key, current)
  })
  const domainLoadSummary = Array.from(domainLoadSummaryMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const executionStatusSummary = {
    running: runningTasks.length,
    queued: queuedTasks.length,
    blocked: poolBoard.filter((item) => item.status === 'blocked' || (item.blocked_by?.length ?? 0) > 0 || item.predicted_block).length,
    needHuman: poolBoard.filter((item) => item.need_human).length,
  }

  const consultantSummary = Array.from(
    sortedBoard
      .filter((item) => item.consultant_id)
      .reduce((map, item) => {
        const key = item.consultant_id as string
        const current = map.get(key) ?? { consultantId: key, owner: item.consultant_owner ?? key, activeLoad: 0, converted: 0, total: 0 }
        current.total += 1
        if (item.converted) current.converted += 1
        if (!item.converted && !item.lost && !['done', 'success', 'cancelled', 'failed'].includes(item.status)) current.activeLoad += 1
        map.set(key, current)
        return map
      }, new Map<string, { consultantId: string; owner: string; activeLoad: number; converted: number; total: number }>()),
  ).map(([, value]) => ({ ...value, conversionRate: value.total ? Math.round((value.converted / value.total) * 100) : 0 }))
    .sort((a, b) => b.activeLoad - a.activeLoad || b.total - a.total)

  const reassignmentRecords = sortedBoard.filter((item) => item.reassigned_to).slice(0, 6)

  const taskGroups = Array.from(
    new Map(
      sortedBoard
        .filter((item) => item.task_group_id)
        .map((item) => [
          item.task_group_id as string,
          {
            id: item.task_group_id as string,
            label: item.task_group_label ?? item.task_group_id ?? '-',
            template: item.template_source ?? item.template_key ?? '-',
            domain: item.domain ?? '-',
            projectLine: item.project_line ?? '-',
            count: sortedBoard.filter((entry) => entry.task_group_id === item.task_group_id).length,
          },
        ]),
    ).values(),
  )

  const parentTaskViews = Array.from(
    new Map(
      sortedBoard
        .filter((item) => item.parent_task_id)
        .map((item) => {
          const parentId = item.parent_task_id as string
          const children = sortedBoard.filter((entry) => entry.parent_task_id === parentId)
          const doneChildren = children.filter((entry) => ['done', 'success', 'cancelled'].includes(entry.status)).length
          const blockedChildren = children.filter((entry) => entry.need_human || entry.status === 'failed' || (entry.blocked_by?.length ?? 0) > 0)
          const progress = children.length ? Math.round((doneChildren / children.length) * 100) : 0
          const blockedPoint = blockedChildren[0]
          return [
            parentId,
            {
              id: parentId,
              title: item.task_group_label?.split(' · ')[0] ?? item.template_source ?? item.template_key ?? parentId,
              template: item.template_source ?? item.template_key ?? '-',
              scenarioId: item.scenario_id ?? '-',
              childCount: children.length,
              progress,
              blockedPoint: blockedPoint
                ? blockedPoint.blocked_by?.[0] ?? blockedChildren[0]?.task_name ?? '-'
                : '—',
              domains: Array.from(new Set(children.map((entry) => entry.domain).filter(Boolean))),
            },
          ]
        }),
    ).values(),
  )

  const notificationTabs: Array<{ key: NotificationDomain; label: string }> = [
    { key: 'builder', label: 'Builder' },
    { key: 'media', label: 'Media' },
    { key: 'family', label: 'Family' },
    { key: 'business', label: 'Business' },
  ]

  const recentNotifications = notifications
    .filter((notice) => notificationTabs.some((tab) => tab.key === notice.domain))
    .slice(0, 12)
  const visibleNotifications = recentNotifications.filter((notice) => notice.domain === activeNoticeDomain)

  return {
    recentDecisions,
    routingDecisionTable,
    routeFocusedTasks,
    recentResults,
    publishSourceGroups,
    archiveDomainGroups,
    archiveContentLineGroups,
    archiveAccountLineGroups,
    currentProfile,
    archiveStructureGroups,
    todayAutoGeneratedTasks,
    riskSummary,
    domainLoadSummary,
    executionStatusSummary,
    consultantSummary,
    reassignmentRecords,
    taskGroups,
    parentTaskViews,
    notificationTabs,
    visibleNotifications,
  }
}
