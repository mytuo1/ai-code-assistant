/** Internal command stub: env — not available in this deployment */
import type { Command } from '../../types/command.js'

const command = {
  name: '/env',
  description: 'env — not available',
  isEnabled: () => false,
  isHidden: true,
  type: 'local',
  call: async () => ({ type: 'text', value: 'Not available.' }),
} as unknown as Command

export default command
// Extra named exports some files may use
export const resetRateLimits = (): void => {}
export const resetExtraUsage = (): void => {}
export const COMMAND_NAME = 'env'
