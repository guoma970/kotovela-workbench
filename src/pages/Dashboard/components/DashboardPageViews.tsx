import type { ReactNode } from 'react'
import type { Agent, Project, UpdateItem } from '../../../types'
import { BRAND_NAME } from '../../../config/brand'
import { brandAssets } from '../../../config/brandAssets'
import { UI_TERMS } from '../../../lib/uiTerms'
import { TodayBriefing } from './TodayBriefing'
import {
  AuditLogPanel,
  ConsultantConfigSummaryCard,
  InternalControlSummary,
  RecentUpdates,
  SectionList,
} from './DashboardOverviewSections'
import type { ActionItem, HomeItem, SystemModeState } from './DashboardOverviewSections'

type ActionResolver = (item: HomeItem) => ActionItem[]
type DashboardExpandedSection = 'overview' | 'attention' | 'decisions'
type DashboardExpandedSections = Record<DashboardExpandedSection, boolean>

const internalStatusLabels = { blocker: UI_TERMS.blocked, active: UI_TERMS.doing, idle: UI_TERMS.idle } as const

function CollapsibleDashboardSection({
  id,
  title,
  summary,
  expanded,
  onToggle,
  children,
}: {
  id: DashboardExpandedSection
  title: string
  summary: string
  expanded: boolean
  onToggle: (id: DashboardExpandedSection) => void
  children: ReactNode
}) {
  return (
    <section className={`dashboard-collapsible-section panel strong-card ${expanded ? 'is-expanded' : ''}`}>
      <div className="dashboard-collapsible-head">
        <div>
          <p className="eyebrow">可展开看板</p>
          <h3>{title}</h3>
          <p>{summary}</p>
        </div>
        <button type="button" className="ghost-button dashboard-collapsible-toggle" onClick={() => onToggle(id)}>
          {expanded ? '收起' : '展开'}
        </button>
      </div>
      {expanded ? <div className="dashboard-collapsible-body">{children}</div> : null}
    </section>
  )
}

type DashboardInternalViewProps = {
  actionMessage: string
  liveOpenClaw: boolean
  isLoading: boolean
  activeDataSource: 'mock' | 'openclaw'
  isFallback: boolean
  agents: Agent[]
  projects: Project[]
  blockers: HomeItem[]
  actives: HomeItem[]
  recentUpdates: UpdateItem[]
  blockerActions: ActionResolver
  activeActions: ActionResolver
  onViewUpdateDetail: (update: UpdateItem) => void
  onOpenProject: (projectId: string) => void
  onOpenAgentsPage: () => void
  lastSyncedAtMs: number | null
  pollingIntervalMs: number
  systemModeState: SystemModeState
  autoTaskSummaryCard: ReactNode
  expandedSections: DashboardExpandedSections
  onToggleSection: (id: DashboardExpandedSection) => void
}

export function DashboardInternalView({
  actionMessage,
  liveOpenClaw,
  isLoading,
  activeDataSource,
  isFallback,
  agents,
  projects,
  blockers,
  actives,
  recentUpdates,
  blockerActions,
  activeActions,
  onViewUpdateDetail,
  onOpenProject,
  onOpenAgentsPage,
  lastSyncedAtMs,
  pollingIntervalMs,
  systemModeState,
  autoTaskSummaryCard,
  expandedSections,
  onToggleSection,
}: DashboardInternalViewProps) {
  return (
    <section className="page home-page-v1 home-page--internal-control">
      <div className="page-header home-header home-header--compact home-header--internal-dash">
        <div className="page-brand-head">
          <div className="page-brand-logo-wrap" aria-hidden="true">
            <img className="page-brand-logo" src={brandAssets.logo} alt="" />
          </div>
          <div>
            <p className="eyebrow">{BRAND_NAME}</p>
            <h2>业务驾驶舱</h2>
          </div>
        </div>
        <p className="page-note home-internal-page-note">
          核心两件事：各同事名下的任务完成情况；各「项目」维度的整体进度（开发、自媒体、家庭事务等可都建成项目，用进度条与卡住的事管控）。
        </p>
      </div>

      <TodayBriefing />

      {actionMessage ? <div className="home-action-feedback">{actionMessage}</div> : null}

      <CollapsibleDashboardSection
        id="overview"
        title={UI_TERMS.officeBoard}
        summary="项目进度、同事状态和当前运行方式都在这里；需要复盘全局时再展开。"
        expanded={expandedSections.overview}
        onToggle={onToggleSection}
      >
        <InternalControlSummary
          livePayload={liveOpenClaw}
          isLoading={isLoading}
          activeDataSource={activeDataSource}
          isFallback={isFallback}
          agents={agents}
          projects={projects}
          onOpenProject={onOpenProject}
          onOpenAgentsIdle={onOpenAgentsPage}
          lastSyncedAtMs={lastSyncedAtMs}
          pollingIntervalMs={pollingIntervalMs}
          systemModeState={systemModeState}
        />
      </CollapsibleDashboardSection>

      <div className="home-v1-grid home-v1-grid--internal">
        <div className="home-internal-main-col">
          <CollapsibleDashboardSection
            id="attention"
            title={UI_TERMS.blocker}
            summary="只放最需要先处理的事项，默认收起，避免首页第一屏太重。"
            expanded={expandedSections.attention}
            onToggle={onToggleSection}
          >
            <SectionList
              title="需处理"
              items={blockers}
              emptyText="当前没有需要优先处理的事项。"
              getActions={blockerActions}
              statusLabels={internalStatusLabels}
              updatedLabel="更新于"
            />
          </CollapsibleDashboardSection>
          <SectionList
            title="进行中"
            items={actives}
            emptyText="当前没有正在推进的事项。"
            getActions={activeActions}
            statusLabels={internalStatusLabels}
            updatedLabel="更新于"
          />
          <CollapsibleDashboardSection
            id="decisions"
            title="待你拍板"
            summary="自动化和需要人工确认的摘要入口；需要处理时展开查看。"
            expanded={expandedSections.decisions}
            onToggle={onToggleSection}
          >
            {autoTaskSummaryCard}
          </CollapsibleDashboardSection>
          <ConsultantConfigSummaryCard />
          <AuditLogPanel />
        </div>
        <RecentUpdates
          updates={recentUpdates}
          onViewDetail={onViewUpdateDetail}
          title="最近动态 / 操作记录入口"
          emptyText="暂无动态。"
          detailLabel="查看"
        />
      </div>
    </section>
  )
}

type DashboardPublicViewProps = {
  actionMessage: string
  activeDataSource: 'mock' | 'openclaw'
  isFallback: boolean
  isLoading: boolean
  blockers: HomeItem[]
  actives: HomeItem[]
  idles: HomeItem[]
  recentUpdates: UpdateItem[]
  blockerActions: ActionResolver
  activeActions: ActionResolver
  idleActions: ActionResolver
  onViewUpdateDetail: (update: UpdateItem) => void
  expandedSections: DashboardExpandedSections
  onToggleSection: (id: DashboardExpandedSection) => void
}

export function DashboardPublicView({
  actionMessage,
  activeDataSource,
  isFallback,
  isLoading,
  blockers,
  actives,
  idles,
  recentUpdates,
  blockerActions,
  activeActions,
  idleActions,
  onViewUpdateDetail,
  expandedSections,
  onToggleSection,
}: DashboardPublicViewProps) {
  return (
    <section className="page home-page-v1">
      <div className="page-header home-header">
        <div className="page-brand-head">
          <div className="page-brand-logo-wrap" aria-hidden="true">
            <img className="page-brand-logo" src={brandAssets.logo} alt="" />
          </div>
          <div>
            <p className="eyebrow">{BRAND_NAME}</p>
            <h2>{BRAND_NAME}</h2>
          </div>
        </div>
        <p className="page-note">
          线上公开站为仓库内置演示数据，不依赖实机 API。克隆仓库后可在本地以演示模式 / 真实数据模式连接 OpenClaw。
        </p>
      </div>

      <div className="home-runtime-strip">
        <span className={`home-runtime-pill ${activeDataSource === 'openclaw' ? 'is-live' : ''}`}>
          {activeDataSource === 'openclaw' && !isFallback ? '实时数据已连接' : '当前使用演示数据'}
        </span>
        <span className="home-runtime-pill">刷新状态：{isLoading ? '数据加载中…' : '已展示最新状态'}</span>
        <span className="home-runtime-pill">模式：公开演示</span>
        {isFallback ? <span className="home-runtime-pill">当前使用演示数据</span> : null}
      </div>

      <TodayBriefing />

      {actionMessage ? <div className="home-action-feedback">{actionMessage}</div> : null}

      <div className="home-v1-grid">
        <CollapsibleDashboardSection
          id="attention"
          title={UI_TERMS.blocker}
          summary="先看有没有卡住的事；没有时就可以继续往下看。"
          expanded={expandedSections.attention}
          onToggle={onToggleSection}
        >
          <SectionList title={UI_TERMS.blocker} items={blockers} emptyText="当前没有卡住的事。" getActions={blockerActions} />
        </CollapsibleDashboardSection>
        <CollapsibleDashboardSection
          id="overview"
          title={UI_TERMS.doing}
          summary="正在推进的事项放在这里，展开后可继续跳转处理。"
          expanded={expandedSections.overview}
          onToggle={onToggleSection}
        >
          <SectionList title={UI_TERMS.doing} items={actives} emptyText="当前没有正在做的事。" getActions={activeActions} />
        </CollapsibleDashboardSection>
        <CollapsibleDashboardSection
          id="decisions"
          title={UI_TERMS.idle}
          summary="暂时待命的同事和事项放在这里，避免占满首屏。"
          expanded={expandedSections.decisions}
          onToggle={onToggleSection}
        >
          <SectionList title={UI_TERMS.idle} items={idles} emptyText="当前没有待命事项。" getActions={idleActions} />
        </CollapsibleDashboardSection>
        <RecentUpdates updates={recentUpdates} onViewDetail={onViewUpdateDetail} />
      </div>
    </section>
  )
}
