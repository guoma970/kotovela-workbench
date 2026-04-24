export const APP_MODE = import.meta.env.VITE_APP_MODE === 'internal' ? 'internal' : 'opensource'

export const BRAND_NAME = APP_MODE === 'internal' ? 'Kotovela Hub' : 'KOTOVELA OSS Demo'

export const brandConfig = {
  name: BRAND_NAME,
  title: BRAND_NAME,
  appTitle: BRAND_NAME,
  description:
    APP_MODE === 'internal'
      ? 'Kotovela Hub · 内部多实例协作驾驶舱'
      : 'KOTOVELA OSS Demo · 开源多实例协作演示（Mock）',
  subtitleZh:
    APP_MODE === 'internal' ? 'Kotovela Hub 内部驾驶舱' : '开源演示 · 多实例协作叙事（内置 Mock）',
  taglineEn:
    APP_MODE === 'internal'
      ? 'Kotovela Hub internal collaboration cockpit'
      : 'KOTOVELA OSS collaboration cockpit · OSS-friendly demo',
} as const
