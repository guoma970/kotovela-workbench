export const UI_TERMS = {
  // 实体
  agent: '同事',
  instance: '同事',
  officeBoard: '办公室一览',
  room: '协作群',
  project: '项目',
  task: '任务',
  blocker: '卡住的事',
  evidence: '结果验收',

  // 状态
  doing: '正在做',
  done: '已完成',
  idle: '待命',
  blocked: '卡住',

  // 模式
  demo: '演示模式',
  internal: '真实数据',
  opensource: '开源版',

  // 技术词
  polling: (sec: number) => `每 ${sec} 秒刷新`,
  snapshot: '离线缓存',
  token: '访问口令',
  drift: '偏差预警',
  modelUsage: 'AI 用量',
  systemControl: '总开关',
} as const

export function t(key: keyof typeof UI_TERMS) {
  return UI_TERMS[key]
}
