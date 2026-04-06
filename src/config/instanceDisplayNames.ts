import { runtimeConfig, type WorkbenchMode } from './runtime'

/**
 * 公开 / Demo：`Agent.name` 用完整产品向一行；`Agent.role` 由 mock 英文叙事填充。
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
 * 内部版：`Agent.name` 只显示称呼（小树、小筑…）；`Agent.role` 用「角色｜职能」
 *（如 Main｜数字指挥官），与称呼分列，不在 name 里堆一整句。
 */
export const OFFICE_INSTANCE_INTERNAL_NICKNAME_BY_KEY: Record<string, string> = {
  main: '小树',
  builder: '小筑',
  media: '小果',
  family: '小羲',
  business: '小言',
  ztl970: 'Personal',
}

export const OFFICE_INSTANCE_INTERNAL_ROLE_BY_KEY: Record<string, string> = {
  main: 'Main｜数字指挥官',
  builder: 'Builder｜开发助手',
  media: 'Media｜内容助手',
  family: 'Family｜家庭助手',
  business: 'Business｜业务助手',
  ztl970: 'ZTL970｜个人助手',
}

/** @deprecated 使用 `OFFICE_INSTANCE_PUBLIC_DISPLAY_NAME_BY_KEY` */
export const OFFICE_INSTANCE_DISPLAY_NAME_BY_KEY = OFFICE_INSTANCE_PUBLIC_DISPLAY_NAME_BY_KEY

/** 兼容旧引用：内部版等同称呼，公开版等同完整展示名 */
export const OFFICE_INSTANCE_INTERNAL_DISPLAY_NAME_BY_KEY = OFFICE_INSTANCE_INTERNAL_NICKNAME_BY_KEY

/**
 * 实例主展示串：内部 = 称呼；公开 = 完整一行。
 * 用于 ObjectBadge、列表主标题、OpenClaw 同步缺省名等。
 */
export function defaultInstanceDisplayName(
  instanceKey: string | undefined,
  mode: WorkbenchMode = runtimeConfig.mode,
): string | undefined {
  const k = instanceKey?.trim().toLowerCase()
  if (!k) return undefined
  return mode === 'internal'
    ? OFFICE_INSTANCE_INTERNAL_NICKNAME_BY_KEY[k]
    : OFFICE_INSTANCE_PUBLIC_DISPLAY_NAME_BY_KEY[k]
}

/** 内部版 `Agent.role`；公开构建返回 `undefined`（由 mock / 数据层英文 role 兜底）。 */
export function defaultInstanceRoleLabel(
  instanceKey: string | undefined,
  mode: WorkbenchMode = runtimeConfig.mode,
): string | undefined {
  const k = instanceKey?.trim().toLowerCase()
  if (!k || mode !== 'internal') return undefined
  return OFFICE_INSTANCE_INTERNAL_ROLE_BY_KEY[k]
}
