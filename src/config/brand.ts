export const APP_MODE = import.meta.env.VITE_APP_MODE === 'internal' ? 'internal' : 'opensource'

export const BRAND_NAME = APP_MODE === 'internal' ? 'Kotovela Hub' : 'KOTOVELA OSS Demo'

export const INTERNAL_PRODUCT_TITLE = APP_MODE === 'internal' ? 'Kotovela Hub' : BRAND_NAME

export const brandConfig = {
  name: BRAND_NAME,
  title: APP_MODE === 'internal' ? BRAND_NAME : BRAND_NAME,
  appTitle: APP_MODE === 'internal' ? BRAND_NAME : BRAND_NAME,
  description:
    APP_MODE === 'internal'
      ? 'Kotovela Hub · 内部业务驾驶舱'
      : 'KOTOVELA OSS Demo · 开源多实例协作演示（Mock）',
  subtitleZh:
    APP_MODE === 'internal' ? '内部驾驶舱 · 协作者状态与项目跟进' : '开源演示 · 多实例协作叙事（内置 Mock）',
  taglineEn:
    APP_MODE === 'internal'
      ? 'KOTOVELA internal business workbench'
      : 'KOTOVELA OSS collaboration cockpit · OSS-friendly demo',
} as const
