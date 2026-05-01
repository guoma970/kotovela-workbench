import type {
  ArchiveCenterEntry,
  PublishCenterEntry,
  TemplatePoolEntry,
} from './DashboardAutoTaskPanel'

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
          <small>use_count {template.use_count}</small>
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
        <span>{entry.domain} · {entry.assetType} · {entry.contentVariant || '-'}</span>
      </div>
      <div className="scheduler-publish-grid">
        <div><span>brand_display</span><p>{entry.brandDisplay || entry.brandLine || '-'}</p></div>
        <div><span>mcn_display</span><p>{entry.mcnDisplay || '-'}</p></div>
        <div><span>account_display</span><p>{entry.accountDisplay || entry.accountLine || '-'}</p></div>
        <div><span>account_type</span><p>{entry.accountType || '-'}</p></div>
        <div><span>tier</span><p>{entry.tier || '-'}</p></div>
        <div><span>route_result</span><p>{entry.routeResult || '-'}</p></div>
        <div><span>route_target</span><p>{entry.routeTarget || '-'}</p></div>
        <div><span>can_close_deal</span><p>{typeof entry.canCloseDeal === 'boolean' ? String(entry.canCloseDeal) : '-'}</p></div>
        <div><span>distribution_channel</span><p>{entry.distributionChannel || '-'}</p></div>
        <div><span>content_variant</span><p>{entry.contentVariant || '-'}</p></div>
        <div><span>source_line</span><p>{entry.sourceLine || '-'}</p></div>
        <div><span>persona</span><p>{entry.result.persona || entry.result.persona_id || '-'}</p></div>
        <div><span>structure_type</span><p>{entry.result.structure_type || '-'}</p></div>
        <div><span>structure_id</span><p>{entry.result.structure_id || '-'}</p></div>
        <div><span>CTA policy</span><p>{entry.result.cta_policy || '-'}</p></div>
        <div><span>骨架摘要</span><p>{entry.result.structure_summary || Object.keys(entry.result.section_map || {}).join(' / ') || '-'}</p></div>
        <div><span>source_type</span><p>{entry.source?.source_type || '-'}</p></div>
        <div><span>source_project</span><p>{entry.source?.source_project || '-'}</p></div>
        <div><span>role_version</span><p>{entry.roleVersion || '-'}</p></div>
        <div><span>章节标题</span><p>{entry.source?.chapter_title || '-'}</p></div>
        <div><span>推荐发布时间</span><p>{entry.result.recommend_publish_time || '-'}</p></div>
        <div><span>发布频率</span><p>{entry.result.recommend_frequency || '-'}</p></div>
        <div><span>今日建议发</span><p>{typeof entry.result.publish_today === 'boolean' ? (entry.result.publish_today ? 'true' : 'false') : '-'}</p></div>
        <div><span>建议标题</span><p>{entry.result.suggested_title || entry.result.title || '-'}</p></div>
        <div><span>首评建议</span><p>{entry.result.suggested_first_comment || '-'}</p></div>
        <div><span>互动问题</span><p>{entry.result.suggested_interaction_question || '-'}</p></div>
        <div><span>风控提示</span><p>{entry.result.publish_risk_warning?.join(' / ') || '无'}</p></div>
      </div>
      {entry.assetType === 'media' ? (
        <div className="scheduler-publish-grid">
          <div><span>title</span><p>{entry.result.title || '-'}</p></div>
          <div><span>hook</span><p>{entry.result.hook || '-'}</p></div>
          <div><span>outline</span><p>{entry.result.outline?.join(' / ') || '-'}</p></div>
          <div><span>script</span><p>{entry.result.script || '-'}</p></div>
          <div><span>publish_text</span><p>{entry.result.publish_text || '-'}</p></div>
        </div>
      ) : null}
      {entry.contentVariant === 'article' ? (
        <div className="scheduler-publish-grid">
          <div><span>structure</span><p>{entry.result.structure?.join(' / ') || entry.result.outline?.join(' / ') || '-'}</p></div>
          <div><span>section_map</span><p>{Object.entries(entry.result.section_map || {}).map(([key, value]) => `${key}: ${value}`).join(' / ') || '-'}</p></div>
          <div><span>full_article</span><p>{entry.result.full_article || entry.result.script || '-'}</p></div>
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
        <span>{entry.assetType} · {entry.contentVariant || '-'}</span>
      </div>
      <div className="scheduler-publish-grid">
        <div><span>brand_display</span><p>{entry.brandDisplay || entry.brandLine || '-'}</p></div>
        <div><span>mcn_display</span><p>{entry.mcnDisplay || '-'}</p></div>
        <div><span>account_display</span><p>{entry.accountDisplay || entry.accountLine || '-'}</p></div>
        <div><span>account_type</span><p>{entry.accountType || '-'}</p></div>
        <div><span>tier</span><p>{entry.tier || '-'}</p></div>
        <div><span>route_result</span><p>{entry.routeResult || '-'}</p></div>
        <div><span>route_target</span><p>{entry.routeTarget || '-'}</p></div>
        <div><span>can_close_deal</span><p>{typeof entry.canCloseDeal === 'boolean' ? String(entry.canCloseDeal) : '-'}</p></div>
        <div><span>distribution_channel</span><p>{entry.distributionChannel || '-'}</p></div>
        <div><span>content_variant</span><p>{entry.contentVariant || '-'}</p></div>
        <div><span>source_line</span><p>{entry.sourceLine || '-'}</p></div>
        <div><span>persona</span><p>{entry.result.persona || entry.result.persona_id || '-'}</p></div>
        <div><span>structure_type</span><p>{entry.result.structure_type || '-'}</p></div>
        <div><span>structure_id</span><p>{entry.result.structure_id || '-'}</p></div>
        <div><span>CTA policy</span><p>{entry.result.cta_policy || '-'}</p></div>
        <div><span>骨架摘要</span><p>{entry.result.structure_summary || Object.keys(entry.result.section_map || {}).join(' / ') || '-'}</p></div>
        <div><span>source_type</span><p>{entry.source?.source_type || '-'}</p></div>
        <div><span>source_project</span><p>{entry.source?.source_project || '-'}</p></div>
        <div><span>role_version</span><p>{entry.roleVersion || '-'}</p></div>
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
