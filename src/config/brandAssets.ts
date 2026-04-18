import { runtimeConfig } from './runtime'

export type BrandAssetMode = 'internal' | 'opensource'

export type BrandAssetConfig = {
  mode: BrandAssetMode
  logoSrc: string
  logoAlt: string
}

const BRAND_ASSETS: Record<BrandAssetMode, BrandAssetConfig> = {
  internal: {
    mode: 'internal',
    logoSrc: '/logos/kotovela.png',
    logoAlt: 'Kotovela logo',
  },
  opensource: {
    mode: 'opensource',
    logoSrc: '/logos/openclaw.png',
    logoAlt: 'OpenClaw logo',
  },
}

export const brandAssets =
  runtimeConfig.mode === 'internal' ? BRAND_ASSETS.internal : BRAND_ASSETS.opensource
