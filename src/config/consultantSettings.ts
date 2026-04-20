import { APP_MODE } from './brand'

export type ConsultantStatus = 'online' | 'busy' | 'offline'

export type ConsultantRecord = {
  consultant_id: string
  name: string
  role: string
  account_type: 'owned' | 'brand' | 'ip' | 'external_partner' | 'demo'
  domain: string
  active_load: number
  status: ConsultantStatus
  assignment_scope: string
  note: string
}

export type ConsultantSettingsConfig = {
  mode: 'internal' | 'opensource'
  pageTitle: string
  pageNote: string
  consultants: ConsultantRecord[]
  ruleSummary: string[]
}

const internalConfig: ConsultantSettingsConfig = {
  mode: 'internal',
  pageTitle: '顾问配置页',
  pageNote: '内部模式展示完整顾问池与分配口径，用于业务侧核对 domain、active_load 与状态。',
  consultants: [
    {
      consultant_id: 'consultant_guoshituan_main',
      name: '果实团团长顾问',
      role: 'group_leader_consultant',
      account_type: 'owned',
      domain: 'business',
      active_load: 6,
      status: 'busy',
      assignment_scope: 'guoshituan / customer_followup / lead_router',
      note: '顾问可兼任团长，主承接客户报价、团购咨询与 CRM 跟进。',
    },
    {
      consultant_id: 'consultant_kotoharo_material',
      name: '言家材料顾问',
      role: 'material_consultant',
      account_type: 'brand',
      domain: 'material_case',
      active_load: 4,
      status: 'online',
      assignment_scope: 'kotoharo / material_case / article lead',
      note: '材料类内容线索默认入口。',
    },
    {
      consultant_id: 'consultant_kotovela_floor_heating',
      name: 'Kotovela 地暖顾问',
      role: 'heating_consultant',
      account_type: 'brand',
      domain: 'floor_heating',
      active_load: 3,
      status: 'online',
      assignment_scope: 'yanfami / floor_heating / official_account',
      note: '地暖热系统咨询优先承接。',
    },
    {
      consultant_id: 'consultant_yanfami_residential',
      name: '言范家住宅顾问',
      role: 'residential_consultant',
      account_type: 'brand',
      domain: 'layout_renovation',
      active_load: 2,
      status: 'online',
      assignment_scope: 'yanfami / layout_renovation / residential',
      note: '户型改造与动线咨询。',
    },
  ],
  ruleSummary: [
    '同 domain 优先命中，active_load 更低者优先。',
    '顾问可兼任团长角色，展示与分配证据统一落在 consultant_id。',
    'external_partner 不直分 consultant_id，lead 场景转 business.lead_router，非 lead 场景拦截。',
    'consult_only / content_only / no_delivery 仍按现有 guardrails 执行，不覆盖 system_mode / publish_mode / force_stop。',
  ],
}

const opensourceConfig: ConsultantSettingsConfig = {
  mode: 'opensource',
  pageTitle: 'Consultant Settings',
  pageNote: 'Open-source mode keeps consultant config isolated and only exposes a minimal mock-safe subset.',
  consultants: [
    {
      consultant_id: 'consultant_demo_business',
      name: 'Demo Business Consultant',
      role: 'business_consultant',
      account_type: 'demo',
      domain: 'business',
      active_load: 2,
      status: 'online',
      assignment_scope: 'demo / business / lead_router',
      note: 'Mock-only consultant sample for OSS builds.',
    },
    {
      consultant_id: 'consultant_demo_material',
      name: 'Demo Material Consultant',
      role: 'material_consultant',
      account_type: 'demo',
      domain: 'material_case',
      active_load: 1,
      status: 'offline',
      assignment_scope: 'demo / material_case',
      note: 'Read-only demo sample, isolated from internal consultant pool.',
    },
  ],
  ruleSummary: [
    'Mock-only consultant samples are isolated from internal data.',
    'external_partner stays unassigned to consultant_id and remains blocked or transferred by existing rules.',
    'Brand isolation and live guardrails remain controlled by existing runtime + scheduler logic.',
  ],
}

export const consultantSettingsConfig = APP_MODE === 'internal' ? internalConfig : opensourceConfig
