import type {
  AutoTaskBoardItem,
  AutoTaskTemplateKey,
  PoolTab,
  PublishCenterEntry,
  TaskCardTone,
} from './autoTaskShared'

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: '待开始',
  pending: '待处理',
  preparing: '准备中',
  queued: '待调度',
  queue: '待调度',
  doing: '执行中',
  running: '执行中',
  paused: '已暂停',
  blocked: '有卡点',
  failed: '执行失败',
  done: '已完成',
  success: '已完成',
  cancelled: '已取消',
}

const TONE_LABELS: Record<TaskCardTone, string> = {
  running: '执行中',
  queue: '待调度',
  paused: '已暂停',
  done: '已完成',
}

const POOL_LABELS: Record<PoolTab['key'], string> = {
  builder: '研发池',
  media: '内容池',
  family: '家庭池',
  business: '业务池',
  personal: '个人池',
}

const POOL_HEALTH_LABELS: Record<PoolTab['health'], string> = {
  healthy: '稳定',
  warning: '注意',
  critical: '告警',
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  owned: '自有账号',
  brand: '品牌账号',
  ip: 'IP账号',
  external_partner: '外部合作方',
  official: '官方账号',
  personal: '个人账号',
  hybrid: '混合账号',
}

const ROUTE_RESULT_LABELS: Record<string, string> = {
  direct: '直达',
  blocked: '拦截',
  transfer: '转派',
}

const CONTENT_VARIANT_LABELS: Record<string, string> = {
  short: '短内容',
  article: '文章',
}

const DISTRIBUTION_CHANNEL_LABELS: Record<string, string> = {
  short_content: '短内容分发',
  official_account: '公众号分发',
}

const ASSET_TYPE_LABELS: Record<PublishCenterEntry['assetType'], string> = {
  media: '内容资产',
  business: '业务素材',
  family: '家庭计划',
  generic: '通用结果',
}

const CTA_POLICY_LABELS: Record<string, string> = {
  default: '常规引导',
  consult_only: '仅咨询引导',
  planting_only: '仅种草引导',
}

const ROLE_VERSION_LABELS: Record<string, string> = {
  yanfami_official: 'YANFAMI 官方号',
  official_account: '官方账号',
  guoma970: '果妈 970',
  mom970: '970 妈妈号',
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  book_manuscript: '书稿素材',
  product_brochure: '产品资料',
  case_booklet: '案例手册',
}

const SOURCE_PROJECT_LABELS: Record<string, string> = {
  japanese_renovation_guide: '日式装修指南',
  product_material_system: '产品资料系统',
  case_library: '案例库',
}

const STRUCTURE_TYPE_LABELS: Record<string, string> = {
  official: '官方结构',
  personal: '个人表达',
  hybrid: '混合结构',
  short_content: '短内容结构',
  article: '文章结构',
  consult_content: '咨询内容结构',
}

const SCENARIO_TEMPLATE_LABELS: Record<AutoTaskTemplateKey, string> = {
  media_publish_with_distribution: '内容发布与分发',
  business_quote_with_materials: '报价与物料协同',
  family_study_evening: '家庭晚间学习',
  media_publish_flow: '内容发布流程',
  business_followup_flow: '客户跟进流程',
  builder_delivery_flow: '研发交付流程',
}

const AUTO_ACTION_LABELS: Record<string, string> = {
  retry: '自动重试',
  warning: '发出预警',
  need_human: '转人工处理',
  notify_result: '同步结果',
}

const RISK_LEVEL_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

const PARTNER_MODE_LABELS: Record<string, string> = {
  content_only: '仅内容协作',
  consult_only: '仅咨询协作',
  no_delivery: '暂停交付',
}

export function formatTaskStatus(value?: string) {
  return value ? (TASK_STATUS_LABELS[value] ?? value) : '-'
}

export function formatTaskTone(value: TaskCardTone) {
  return TONE_LABELS[value]
}

export function formatPoolKey(value?: PoolTab['key']) {
  return value ? POOL_LABELS[value] : '-'
}

export function formatPoolHealth(value?: PoolTab['health']) {
  return value ? POOL_HEALTH_LABELS[value] : '-'
}

export function formatAccountType(value?: AutoTaskBoardItem['account_type']) {
  return value ? (ACCOUNT_TYPE_LABELS[value] ?? value) : '-'
}

export function formatRouteResult(value?: AutoTaskBoardItem['route_result']) {
  return value ? (ROUTE_RESULT_LABELS[value] ?? value) : '-'
}

export function formatContentVariant(value?: AutoTaskBoardItem['content_variant']) {
  return value ? (CONTENT_VARIANT_LABELS[value] ?? value) : '-'
}

export function formatDistributionChannel(value?: AutoTaskBoardItem['distribution_channel']) {
  return value ? (DISTRIBUTION_CHANNEL_LABELS[value] ?? value) : '-'
}

export function formatAssetType(value: PublishCenterEntry['assetType']) {
  return ASSET_TYPE_LABELS[value]
}

export function formatCtaPolicy(value?: string) {
  return value ? (CTA_POLICY_LABELS[value] ?? value) : '-'
}

export function formatRoleVersion(value?: AutoTaskBoardItem['role_version']) {
  return value ? (ROLE_VERSION_LABELS[value] ?? value) : '-'
}

export function formatSourceType(value?: AutoTaskBoardItem['source'] extends infer S ? S extends { source_type?: infer T } ? T : never : never) {
  return value ? (SOURCE_TYPE_LABELS[String(value)] ?? String(value)) : '-'
}

export function formatSourceProject(value?: AutoTaskBoardItem['source'] extends infer S ? S extends { source_project?: infer T } ? T : never : never) {
  return value ? (SOURCE_PROJECT_LABELS[String(value)] ?? String(value)) : '-'
}

export function formatStructureType(value?: string) {
  return value ? (STRUCTURE_TYPE_LABELS[value] ?? value) : '-'
}

export function formatScenarioTemplate(value?: string) {
  return value ? (SCENARIO_TEMPLATE_LABELS[value as AutoTaskTemplateKey] ?? value) : '-'
}

export function formatAutoAction(value?: AutoTaskBoardItem['auto_action']) {
  return value ? (AUTO_ACTION_LABELS[value] ?? value) : '-'
}

export function formatRiskLevel(value?: string) {
  return value ? (RISK_LEVEL_LABELS[value] ?? value) : '-'
}

export function formatPartnerMode(value?: string | null) {
  return value ? (PARTNER_MODE_LABELS[value] ?? value) : '-'
}

export function formatBooleanDecision(value?: boolean) {
  if (typeof value !== 'boolean') return '-'
  return value ? '是' : '否'
}

export function formatDecisionAction(value: string) {
  return formatAutoAction(value as AutoTaskBoardItem['auto_action']) || value
}
