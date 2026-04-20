import { APP_MODE } from './brand'

export type BrandAssetMode = 'internal' | 'opensource'

export type BrandAssetConfig = {
  mode: BrandAssetMode
  name: string
  logo: string
  logoAlt: string
}

const BRAND_ASSETS: Record<BrandAssetMode, BrandAssetConfig> = {
  internal: {
    mode: 'internal',
    name: 'Kotovela',
    logo: '/logos/kotovela.png',
    logoAlt: 'Kotovela logo',
  },
  opensource: {
    mode: 'opensource',
    name: 'KOTOVELA OSS Demo',
    logo: '/logos/kotovela.png',
    logoAlt: 'KOTOVELA OSS Demo logo',
  },
}

export const brandAssets = BRAND_ASSETS[APP_MODE]
