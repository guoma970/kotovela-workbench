import type { AutoTaskTemplateKey } from './autoTaskShared'

export const AUTO_TASK_SCENARIO_TEMPLATES: Array<{
  key: AutoTaskTemplateKey
  label: string
  description: string
}> = [
  { key: 'media_publish_with_distribution', label: 'media_publish_with_distribution', description: '跨域发布 + 分发 + 落地页' },
  { key: 'business_quote_with_materials', label: 'business_quote_with_materials', description: '跨域报价 + 物料 + 家庭确认' },
  { key: 'family_study_evening', label: 'family_study_evening', description: '晚间学习任务链' },
  { key: 'media_publish_flow', label: 'media_publish_flow', description: '内容发布任务链' },
  { key: 'business_followup_flow', label: 'business_followup_flow', description: '客户跟进任务链' },
  { key: 'builder_delivery_flow', label: 'builder_delivery_flow', description: '研发交付任务链' },
]
