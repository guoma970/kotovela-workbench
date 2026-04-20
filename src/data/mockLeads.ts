export type MockLeadItem = {
  lead_id: string
  name: string
  source: string
  status: string
  owner: string
  updated_at: string
}

export const mockLeads: MockLeadItem[] = [
  {
    lead_id: 'lead-oss-001',
    name: '厨房改造报价咨询',
    source: 'opensource_demo',
    status: 'queued',
    owner: 'demo-business',
    updated_at: 'just now',
  },
  {
    lead_id: 'lead-oss-002',
    name: '老房翻新动线优化',
    source: 'opensource_demo',
    status: 'in_progress',
    owner: 'demo-consultant',
    updated_at: '3 min ago',
  },
  {
    lead_id: 'lead-oss-003',
    name: '材料清单确认',
    source: 'opensource_demo',
    status: 'converted',
    owner: 'demo-ops',
    updated_at: '10 min ago',
  },
]
