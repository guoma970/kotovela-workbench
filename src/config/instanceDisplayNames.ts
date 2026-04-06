import { runtimeConfig, type WorkbenchMode } from './runtime'

/**
 * 公开 / Demo 构建：完整展示名，不含内部「小×」称呼；Family 为产品向叙事（与内部版 Family 小羲 区分）。
 */
export const OFFICE_INSTANCE_PUBLIC_DISPLAY_NAME_BY_KEY: Record<string, string> = {
  main: 'Main｜系统协调与编排',
  builder: 'Builder｜产品实现',
  media: 'Media｜内容运营',
  family: 'Family ｜家庭助手',
  business: 'Business｜商业分析',
  ztl970: 'Platform｜综合支援',
}

/**
 * 内部构建：与 Family 同结构的「角色＋称呼｜职能」全文，用于列表与徽章上的实例名。
 */
export const OFFICE_INSTANCE_INTERNAL_DISPLAY_NAME_BY_KEY: Record<string, string> = {
  main: 'Main 小树｜系统协调与编排',
  builder: 'Builder 小筑｜产品实现',
  media: 'Media 小果｜内容运营',
  family: 'Family 小羲｜家庭助手',
  business: 'Business 小言｜商业分析',
  ztl970: 'Platform 小柒｜综合支援',
}

/** @deprecated 使用 `OFFICE_INSTANCE_PUBLIC_DISPLAY_NAME_BY_KEY` */
export const OFFICE_INSTANCE_DISPLAY_NAME_BY_KEY = OFFICE_INSTANCE_PUBLIC_DISPLAY_NAME_BY_KEY

export function defaultInstanceDisplayName(
  instanceKey: string | undefined,
  mode: WorkbenchMode = runtimeConfig.mode,
): string | undefined {
  const k = instanceKey?.trim().toLowerCase()
  if (!k) return undefined
  return mode === 'internal'
    ? OFFICE_INSTANCE_INTERNAL_DISPLAY_NAME_BY_KEY[k]
    : OFFICE_INSTANCE_PUBLIC_DISPLAY_NAME_BY_KEY[k]
}
