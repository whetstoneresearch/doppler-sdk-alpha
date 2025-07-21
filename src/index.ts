export const VERSION = '0.0.1'

export type DopplerVersion = 'v3' | 'v4'

export interface DopplerSDKConfig {
  version: DopplerVersion
  rpcUrl?: string
}