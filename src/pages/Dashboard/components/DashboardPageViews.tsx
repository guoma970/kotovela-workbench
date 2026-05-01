import type { ReactNode } from 'react'
import type { Agent, Project, UpdateItem } from '../../../types'
import { BRAND_NAME, INTERNAL_PRODUCT_TITLE } from '../../../config/brand'
import { brandAssets } from '../../../config/brandAssets'
import {
  AuditLogPanel,
  ConsultantConfigSummaryCard,
  InternalControlSummary,
  RecentUpdates,
  SectionList,
} from './DashboardOverviewSections'
import type { ActionItem, HomeItem, SystemModeState } from './DashboardOverviewSections'

type ActionResolver = (item: HomeItem) => ActionItem[]

const internalStatusLabels = { blocker: '阻塞', active: '进行中', idle: '待命' } as const

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
}: DashboardInternalViewProps) {
  return (
    <section className="page home-page-v1 home-page--internal-control">
      <div className="page-header home-header home-header--compact home-header--internal-dash">
        <div className="page-brand-head">
          <div className="page-brand-logo-wrap" aria-hidden="true">
            <img className="page-brand-logo" src={brandAssets.logo} alt="" />
          </div>
          <div>
            <p className="eyebrow">{INTERNAL_PRODUCT_TITLE}</p>
            <h2>业务驾驶舱</h2>
          </div>
        </div>
        <p className="page-note home-internal-page-note">
          核心两件事：各实例在你名下的任务完成情况；各「项目」维度的整体进度（开发、自媒体、家庭事务等可都建成项目，用进度条与阻塞数管控）。
        </p>
      </div>

      {actionMessage ? <div className="home-action-feedback">{actionMessage}</div> : null}

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

      <div className="home-v1-grid home-v1-grid--internal">
        <div className="home-internal-main-col">
          <SectionList
            title="需处理"
            items={blockers}
            emptyText="当前没有阻塞实例。"
            getActions={blockerActions}
            statusLabels={internalStatusLabels}
            updatedLabel="更新于"
          />
          <SectionList
            title="进行中"
            items={actives}
            emptyText="当前没有进行中的实例。"
            getActions={activeActions}
            statusLabels={internalStatusLabels}
            updatedLabel="更新于"
          />
          {autoTaskSummaryCard}
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
          线上公开站为仓库内置 <strong>Mock</strong>，不依赖实机 API。克隆仓库后可在本地以 Demo / Internal 模式连接 OpenClaw。
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

      {actionMessage ? <div className="home-action-feedback">{actionMessage}</div> : null}

      <div className="home-v1-grid">
        <SectionList title="Blocker" items={blockers} emptyText="No blockers right now." getActions={blockerActions} />
        <SectionList title="Active" items={actives} emptyText="No active items right now." getActions={activeActions} />
        <SectionList title="Idle" items={idles} emptyText="No idle items right now." getActions={idleActions} />
        <RecentUpdates updates={recentUpdates} onViewDetail={onViewUpdateDetail} />
      </div>
    </section>
  )
}
