export const brandConfig = {
  name: import.meta.env.VITE_BRAND_NAME?.trim() || 'Kotovela Hub',
  title: import.meta.env.VITE_BRAND_TITLE?.trim() || import.meta.env.VITE_BRAND_NAME?.trim() || 'Kotovela Hub',
  appTitle: import.meta.env.VITE_BRAND_APP_TITLE?.trim() || import.meta.env.VITE_BRAND_NAME?.trim() || 'Kotovela Hub',
  description:
    import.meta.env.VITE_BRAND_DESCRIPTION?.trim() || 'Kotovela Hub · 开源多实例协作演示（Mock）',
  subtitleZh:
    import.meta.env.VITE_BRAND_SUBTITLE_ZH?.trim() || '开源演示 · 多实例协作叙事（内置 Mock）',
  taglineEn:
    import.meta.env.VITE_BRAND_TAGLINE_EN?.trim() || 'Kotovela Hub collaboration cockpit · OSS-friendly demo',
} as const
