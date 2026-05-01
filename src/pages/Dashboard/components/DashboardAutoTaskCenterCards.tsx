import type {
  ArchiveCenterEntry,
  PublishCenterEntry,
  TemplatePoolEntry,
} from '../lib/autoTaskShared'
import {
  formatAccountType,
  formatAssetType,
  formatBooleanDecision,
  formatContentVariant,
  formatCtaPolicy,
  formatDistributionChannel,
  formatRoleVersion,
  formatRouteResult,
  formatSourceProject,
  formatSourceType,
  formatStructureType,
} from '../lib/autoTaskLabels'

function getRecommendedTemplates(
  templates: TemplatePoolEntry[],
  domain: string,
  assetType: PublishCenterEntry['assetType'],
) {
  const expectedAssetType =
    assetType === 'media'
      ? 'script'
      : assetType === 'business'
        ? 'reply'
        : assetType === 'family'
          ? 'plan'
          : 'generic'

  return templates
    .filter((template) => template.domain === domain && template.asset_type === expectedAssetType)
    .sort((a, b) => {
      if (b.use_count !== a.use_count) return b.use_count - a.use_count
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    .slice(0, 2)
}

function TemplateRecommendations({
  templates,
}: {
  templates: TemplatePoolEntry[]
}) {
  return (
    <div className="scheduler-template-recommendations">
      <span>推荐相似模板</span>
      {templates.length ? templates.map((template) => (
        <div className="scheduler-template-rec-item" key={template.template_id}>
          <strong>{template.source_task_name ?? template.template_id}</strong>
          <small>复用 {template.use_count} 次</small>
        </div>
      )) : <small>暂无</small>}
    </div>
  )
}

export function PublishCenterCard({
  entry,
  templatePool,
  controlLoadingTask,
  onManualPublished,
}: {
  entry: PublishCenterEntry
  templatePool: TemplatePoolEntry[]
  controlLoadingTask: string
  onManualPublished: (taskName: string) => void
}) {
  const recommendedTemplates = getRecommendedTemplates(templatePool, entry.domain, entry.assetType)

  return (
    <article className="scheduler-result-item scheduler-center-card">
      <div className="scheduler-center-card-top">
        <strong>{entry.taskName}</strong>
        <span>{entry.domain} · {formatAssetType(entry.assetType)} · {formatContentVariant(entry.contentVariant)}</span>
      </div>
      <div className="scheduler-publish-grid">
        <div><span>品牌</span><p>{entry.brandDisplay || entry.brandLine || '-'}</p></div>
        <div><span>协作矩阵</span><p>{entry.mcnDisplay || '-'}</p></div>
        <div><span>账号</span><p>{entry.accountDisplay || entry.accountLine || '-'}</p></div>
        <div><span>账号类型</span><p>{formatAccountType(entry.accountType)}</p></div>
        <div><span>tier</span><p>{entry.tier || '-'}</p></div>
        <div><span>路由结果</span><p>{formatRouteResult(entry.routeResult)}</p></div>
        <div><span>路由目标</span><p>{entry.routeTarget || '-'}</p></div>
        <div><span>可否成交</span><p>{formatBooleanDecision(entry.canCloseDeal)}</p></div>
        <div><span>分发渠道</span><p>{formatDistributionChannel(entry.distributionChannel)}</p></div>
        <div><span>内容形态</span><p>{formatContentVariant(entry.contentVariant)}</p></div>
        <div><span>来源线</span><p>{entry.sourceLine || '-'}</p></div>
        <div><span>人设</span><p>{entry.result.persona || entry.result.persona_id || '-'}</p></div>
        <div><span>结构类型</span><p>{formatStructureType(entry.result.structure_type)}</p></div>
        <div><span>结构模板</span><p>{entry.result.structure_id || '-'}</p></div>
        <div><span>转化策略</span><p>{formatCtaPolicy(entry.result.cta_policy)}</p></div>
        <div><span>骨架摘要</span><p>{entry.result.structure_summary || Object.keys(entry.result.section_map || {}).join(' / ') || '-'}</p></div>
        <div><span>素材来源</span><p>{formatSourceType(entry.source?.source_type)}</p></div>
        <div><span>素材项目</span><p>{formatSourceProject(entry.source?.source_project)}</p></div>
        <div><span>发布角色</span><p>{formatRoleVersion(entry.roleVersion)}</p></div>
        <div><span>章节标题</span><p>{entry.source?.chapter_title || '-'}</p></div>
        <div><span>推荐发布时间</span><p>{entry.result.recommend_publish_time || '-'}</p></div>
        <div><span>发布频率</span><p>{entry.result.recommend_frequency || '-'}</p></div>
        <div><span>今日建议发</span><p>{formatBooleanDecision(entry.result.publish_today)}</p></div>
        <div><span>建议标题</span><p>{entry.result.suggested_title || entry.result.title || '-'}</p></div>
        <div><span>首评建议</span><p>{entry.result.suggested_first_comment || '-'}</p></div>
        <div><span>互动问题</span><p>{entry.result.suggested_interaction_question || '-'}</p></div>
        <div><span>风控提示</span><p>{entry.result.publish_risk_warning?.join(' / ') || '无'}</p></div>
      </div>
      {entry.assetType === 'media' ? (
        <div className="scheduler-publish-grid">
          <div><span>标题</span><p>{entry.result.title || '-'}</p></div>
          <div><span>开场钩子</span><p>{entry.result.hook || '-'}</p></div>
          <div><span>提纲</span><p>{entry.result.outline?.join(' / ') || '-'}</p></div>
          <div><span>正文脚本</span><p>{entry.result.script || '-'}</p></div>
          <div><span>发布文案</span><p>{entry.result.publish_text || '-'}</p></div>
        </div>
      ) : null}
      {entry.contentVariant === 'article' ? (
        <div className="scheduler-publish-grid">
          <div><span>文章结构</span><p>{entry.result.structure?.join(' / ') || entry.result.outline?.join(' / ') || '-'}</p></div>
          <div><span>章节安排</span><p>{Object.entries(entry.result.section_map || {}).map(([key, value]) => `${key}: ${value}`).join(' / ') || '-'}</p></div>
          <div><span>完整文章</span><p>{entry.result.full_article || entry.result.script || '-'}</p></div>
        </div>
      ) : null}
      {entry.assetType === 'business' ? (
        <div className="scheduler-publish-grid">
          <div><span>摘要</span><p>{entry.result.content || entry.result.title || '-'}</p></div>
          <div><span>跟进建议</span><p>{entry.result.publish_text || entry.result.hook || '-'}</p></div>
        </div>
      ) : null}
      {entry.assetType === 'family' ? (
        <div className="scheduler-publish-grid">
          <div><span>学习计划</span><p>{entry.result.outline?.join(' / ') || entry.result.content || '-'}</p></div>
          <div><span>提醒文案</span><p>{entry.result.publish_text || entry.result.hook || '-'}</p></div>
        </div>
      ) : null}
      {entry.assetType === 'generic' ? (
        <div className="scheduler-publish-grid">
          <div><span>摘要</span><p>{entry.result.content || '-'}</p></div>
        </div>
      ) : null}
      <div className="scheduler-center-actions">
        <button className="auto-task-row-btn" type="button" onClick={async () => { await navigator.clipboard.writeText(entry.result.publish_text || entry.result.content || '') }}>
          复制可发布内容
        </button>
        <button className="auto-task-row-btn" type="button" onClick={() => onManualPublished(entry.taskName)}>
          {controlLoadingTask === `${entry.taskName}:mark_manual_published` ? '记录中...' : '人工已发布'}
        </button>
        <small>{entry.updatedAt ?? '-'}</small>
      </div>
      {entry.result.manual_published_at ? <small>已由 {entry.result.manual_published_by || '-'} 于 {entry.result.manual_published_at} 记录人工发布</small> : null}
      <TemplateRecommendations templates={recommendedTemplates} />
    </article>
  )
}

export function ArchiveCenterCard({
  entry,
  templatePool,
  controlLoadingTask,
  onMarkTemplateSource,
}: {
  entry: ArchiveCenterEntry
  templatePool: TemplatePoolEntry[]
  controlLoadingTask: string
  onMarkTemplateSource: (taskName: string) => void
}) {
  const recommendedTemplates = getRecommendedTemplates(templatePool, entry.domain, entry.assetType)

  return (
    <article className="scheduler-result-item scheduler-center-card">
      <div className="scheduler-center-card-top">
        <strong>{entry.taskName}</strong>
        <span>{formatAssetType(entry.assetType)} · {formatContentVariant(entry.contentVariant)}</span>
      </div>
      <div className="scheduler-publish-grid">
        <div><span>品牌</span><p>{entry.brandDisplay || entry.brandLine || '-'}</p></div>
        <div><span>协作矩阵</span><p>{entry.mcnDisplay || '-'}</p></div>
        <div><span>账号</span><p>{entry.accountDisplay || entry.accountLine || '-'}</p></div>
        <div><span>账号类型</span><p>{formatAccountType(entry.accountType)}</p></div>
        <div><span>tier</span><p>{entry.tier || '-'}</p></div>
        <div><span>路由结果</span><p>{formatRouteResult(entry.routeResult)}</p></div>
        <div><span>路由目标</span><p>{entry.routeTarget || '-'}</p></div>
        <div><span>可否成交</span><p>{formatBooleanDecision(entry.canCloseDeal)}</p></div>
        <div><span>分发渠道</span><p>{formatDistributionChannel(entry.distributionChannel)}</p></div>
        <div><span>内容形态</span><p>{formatContentVariant(entry.contentVariant)}</p></div>
        <div><span>来源线</span><p>{entry.sourceLine || '-'}</p></div>
        <div><span>人设</span><p>{entry.result.persona || entry.result.persona_id || '-'}</p></div>
        <div><span>结构类型</span><p>{formatStructureType(entry.result.structure_type)}</p></div>
        <div><span>结构模板</span><p>{entry.result.structure_id || '-'}</p></div>
        <div><span>转化策略</span><p>{formatCtaPolicy(entry.result.cta_policy)}</p></div>
        <div><span>骨架摘要</span><p>{entry.result.structure_summary || Object.keys(entry.result.section_map || {}).join(' / ') || '-'}</p></div>
        <div><span>素材来源</span><p>{formatSourceType(entry.source?.source_type)}</p></div>
        <div><span>素材项目</span><p>{formatSourceProject(entry.source?.source_project)}</p></div>
        <div><span>发布角色</span><p>{formatRoleVersion(entry.roleVersion)}</p></div>
        <div><span>章节标题</span><p>{entry.source?.chapter_title || '-'}</p></div>
      </div>
      <p>{entry.result.content || entry.result.publish_text || '-'}</p>
      <div className="scheduler-center-actions">
        <button className="auto-task-row-btn" type="button" onClick={async () => { await navigator.clipboard.writeText(JSON.stringify(entry.result, null, 2)) }}>
          复制
        </button>
        <button className="auto-task-row-btn" type="button" onClick={() => onMarkTemplateSource(entry.taskName)}>
          {controlLoadingTask === `${entry.taskName}:mark_template_source` ? '标记中...' : '标记为模板来源'}
        </button>
        <small>{entry.updatedAt ?? '-'}</small>
      </div>
      <TemplateRecommendations templates={recommendedTemplates} />
    </article>
  )
}
