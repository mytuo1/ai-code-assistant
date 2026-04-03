import { isEnvTruthy } from '../../utils/envUtils.js'
export function isAnalyticsDisabled(): boolean {
  return isEnvTruthy(process.env.DISABLE_ANALYTICS)
}
