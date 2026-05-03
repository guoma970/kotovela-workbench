const READABLE_LABELS: Record<string, string> = {
  account_line: '账号线索',
  account_ops: '账号运营',
  active: '进行中',
  ai_tools: 'AI 工具',
  article: '文章',
  assigned: '已分配',
  assign: '指派负责人',
  blocked: '有卡点',
  book_manuscript: '书稿协作',
  book_manuscript_role_distribution: '书稿角色分配',
  brand: '品牌账号',
  builder: '研发执行',
  builder_a: '小筑 / 开发执行',
  builder_api: '接口研发',
  builder_bugfix: '修复任务',
  builder_default: '研发默认池',
  builder_delivery_flow: '研发交付流程',
  builder_page: '页面开发',
  business: '业务跟进',
  business_followup_flow: '客户跟进流程',
  business_pool: '业务池',
  business_quote_with_materials: '报价与物料协同',
  business_default: '业务默认分配',
  cancelled: '已取消',
  chongming_storage: '崇明收纳',
  consult_only: '仅咨询协作',
  consultant_assigned: '已完成顾问分配',
  content_line: '内容线索',
  content_only: '仅内容协作',
  content_ops: '内容运营',
  customer_followup: '客户跟进',
  decision_log: '处理记录',
  dependency_precheck: '依赖预检',
  dependency_ready: '依赖已就绪',
  dependency_resolved: '依赖已解除',
  dependency_waiting: '等待依赖完成',
  default_delivery: '默认交付规则',
  direct: '直达',
  done: '已完成',
  demo: '演示账号',
  external_partner: '外部合作方',
  external_partner_deal_restricted: '外部合作方不可直接成交',
  failed: '失败',
  family: '家庭协作',
  family_study: '家庭学习',
  family_study_evening: '家庭晚间学习',
  floor_heating: '地暖系统',
  growth_record: '成长记录',
  group_buy_material: '团购材料',
  guoma970: '果妈970',
  guoshituan_main: '果实团顾问',
  guoshituan_official: '果实团官方号',
  high: '高',
  human_done: '人工确认完成',
  ip: 'IP 账号',
  invalid_account_filtered: '已过滤不合适账号',
  kitchen_storage: '厨房收纳',
  kitchen: '厨房收纳',
  kotoharo_material: '建材顾问',
  kotoharo_official: '言家官方号',
  kotovela_official: 'Kotovela 官方号',
  layout_renovation: '户型改造',
  latin_boy: '拉丁男孩果果',
  latin_boy_guoguo: '拉丁男孩果果',
  lead_auto_transfer: '线索自动转派',
  lead_bound: '已绑定线索',
  lead_created: '已创建待跟进事项',
  lost: '已流失',
  low: '低',
  manual_continue: '人工确认继续',
  manual_done: '人工确认完成',
  manual_ignore: '人工忽略',
  manual_review: '人工复核',
  manual_review_required: '待人工复核',
  material_case: '材料案例',
  media: '内容协作',
  media_pool: '内容池',
  media_publish_flow: '内容发布流程',
  media_publish_with_distribution: '内容发布与分发',
  medium: '中',
  mom970: '果妈970',
  need_human: '待人工处理',
  no_delivery: '暂停交付',
  notify_result: '已同步结果',
  openclaw_content: 'OpenClaw 内容运营',
  owned: '自有账号',
  paused: '已暂停',
  pending: '待处理',
  personal: '个人助手',
  personal_reminder: '个人提醒',
  predictive_risk: '预测风险',
  preparing: '准备中',
  priority_down: '降低优先级',
  priority_up: '提高优先级',
  profile_bootstrap: '命中画像规则',
  profile_preference_match: '命中偏好规则',
  project_line: '项目线索',
  quota_exceeded: '额度已用完',
  queued: '待调度',
  queue: '待调度',
  rate_limited: '触发频率限制',
  retry: '重试',
  route_result: '去向判断',
  route_target: '分配去向',
  role_distribution: '角色分配',
  running: '执行中',
  short_content: '短内容',
  self_operated: '自运营账号',
  source_line: '来源频道',
  standard_routing_direct_pass: '标准分配已通过',
  strategy_generate_task: '生成策略任务',
  success: '已完成',
  system: '系统自动记录',
  task_created: '已创建任务',
  template_hit: '命中模板',
  todo: '待开始',
  transfer: '转派',
  takeover: '人工接管',
  unblocked: '解除阻塞',
  yanfami_official: '言范家官方号',
  yanfami_residential: '住宅顾问',
}

const OWNER_LABELS: Record<string, string> = {
  main: '小树 / 中枢调度',
  builder: '小筑 / 开发执行',
  media: '小果 / 内容助手',
  family: '小羲 / 家庭助手',
  business: '小言 / 业务助手',
  personal: '小柒 / 个人助手',
  ztl970: '果妈970 / 项目负责人',
  unassigned: '暂未分配',
}

const normalizeKey = (value: string) =>
  value
    .trim()
    .replace(/^consultant_/i, '')
    .replace(/^route[._-]/i, 'route_')
    .replace(/[.\s-]+/g, '_')
    .toLowerCase()

export function formatReadableKey(value?: string, fallback = '暂未同步') {
  if (!value || value === '-') return fallback
  const trimmed = value.trim()
  const normalized = normalizeKey(trimmed)
  if (READABLE_LABELS[trimmed]) return READABLE_LABELS[trimmed]
  if (READABLE_LABELS[normalized]) return READABLE_LABELS[normalized]
  return trimmed
    .replace(/^oc_[a-z0-9]+$/i, '飞书群会话')
    .replace(/^task[-_]/i, '任务 ')
    .replace(/^room[-_]/i, '频道 ')
    .replace(/^project[-_]/i, '项目 ')
    .replace(/^consultant[-_]/i, '顾问 ')
    .replace(/media_publish_with_distribution/gi, '内容发布与分发')
    .replace(/business_quote_with_materials/gi, '报价与物料协同')
    .replace(/book[_ ]manuscript[_ ]role[_ ]distribution/gi, '书稿角色分配')
    .replace(/book[_ ]manuscript/gi, '书稿协作')
    .replace(/family_study_evening/gi, '家庭晚间学习')
    .replace(/openclaw_content/gi, 'OpenClaw 内容运营')
    .replace(/builder_page/gi, '页面开发')
    .replace(/external_partner/gi, '外部合作方')
    .replace(/standard[_ ]routing[_ ]direct[_ ]pass/gi, '标准分配已通过')
    .replace(/dependency[_ ]waiting/gi, '等待依赖完成')
    .replace(/lead[_ ]created/gi, '已创建待跟进事项')
    .replace(/task[_ ]created/gi, '已创建任务')
    .replace(/customer_followup/gi, '客户跟进')
    .replace(/layout_renovation/gi, '户型改造')
    .replace(/kitchen_storage/gi, '厨房收纳')
    .replace(/material_case/gi, '材料案例')
    .replace(/floor_heating/gi, '地暖系统')
    .replace(/yanfami_official/gi, '言范家官方号')
    .replace(/kotoharo_official/gi, '言家官方号')
    .replace(/guoshituan_official/gi, '果实团官方号')
    .replace(/[._-]+/g, ' ')
}

export function formatReadableOwner(value?: string, fallback = '暂未分配') {
  if (!value || value === '-') return fallback
  const key = normalizeKey(value.replace(/^实例\s*/i, ''))
  if (key.includes('builder')) return OWNER_LABELS.builder
  if (key.includes('media')) return OWNER_LABELS.media
  if (key.includes('family')) return OWNER_LABELS.family
  if (key.includes('business')) return OWNER_LABELS.business
  if (key.includes('personal')) return OWNER_LABELS.personal
  return OWNER_LABELS[key] ?? formatReadableKey(value, fallback)
}

export function formatReadableDetail(value?: string, fallback = '暂无说明') {
  if (!value || value === '-') return fallback
  return value
    .replace(/当前缺少\s*live session/gi, '当前没有实时会话')
    .replace(/live session/gi, '实时会话')
    .replace(/snapshot\(([^)]+)\)\s*兜底/gi, '快照兜底（$1）')
    .replace(/snapshot\s*/gi, '快照 ')
    .replace(/lead created for/gi, '已创建待跟进事项：')
    .replace(/task created for/gi, '已创建任务：')
    .replace(/predicted risk high/gi, '预测高风险')
    .replace(/standard routing direct pass/gi, '标准分配已通过')
    .replace(/dependency waiting/gi, '等待依赖完成')
    .replace(/manual_review\.required/gi, '待人工复核')
    .replace(/business\.lead_router/gi, '业务跟进池')
    .replace(/assigned to/gi, '已分配给')
    .replace(/routes to/gi, '分配给')
    .replace(/changes priority and writes decision log/gi, '调整优先级并记录依据')
    .replace(/pause sets status paused/gi, '任务已暂停')
    .replace(/resume clears pause state and returns active control/gi, '任务已恢复处理')
    .replace(/template creates blocked dependency tasks and decision log/gi, '模板已生成依赖任务和处理记录')
    .replace(/blocked tasks later emit unblocked\/dependency_resolved evidence/gi, '依赖解除后会补充完成依据')
    .replace(/\bround\s*[-_ ]?(\d+)\b/gi, '第 $1 轮')
    .split(/\s*([·|/→])\s*/)
    .map((part) => (/^[·|/→]$/.test(part) ? part : formatReadableKey(part, part)))
    .join(' ')
    .replace(/\s+([·|/→])\s+/g, ' $1 ')
    .trim()
}

export function formatReadableTaskTitle(value?: string, fallback = '事项内容暂未同步') {
  if (!value || value === '-') return fallback
  return formatReadableDetail(value)
    .replace(/^DEV\s*\d{8}\s*\d+\s*/i, '')
    .replace(/^DEV[-_\s]*/i, '')
    .replace(/\bstab-\d+\s*/gi, '')
    .replace(/\b\d{10,}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+·/g, ' ·')
    .trim()
}

export function formatReadableTime(value?: string, fallback = '暂未同步') {
  if (!value || value === '-') return fallback
  if (/^刚刚|^最近|^超过/.test(value)) return value
  if (/^snapshot/i.test(value)) return value.replace(/^snapshot\s*/i, '快照时间：')
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return formatReadableDetail(value, fallback)
  const diffMs = Date.now() - timestamp
  if (diffMs >= 0) {
    const minutes = Math.floor(diffMs / 60_000)
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `最近 ${minutes} 分钟`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `最近 ${hours} 小时`
  }
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(timestamp)
}
