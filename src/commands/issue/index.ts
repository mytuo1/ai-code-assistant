/** Internal command stub: issue — not available in this deployment */
import type { Command } from '../../types/command.js'

const command = {
  name: '/issue',
  description: 'issue — not available',
  isEnabled: () => false,
  isHidden: true,
  type: 'local',
  call: async () => ({ type: 'text', value: 'Not available.' }),
} as unknown as Command

export default command
// Extra named exports some files may use
export const resetRateLimits = (): void => {}
export const resetExtraUsage = (): void => {}
export const COMMAND_NAME = 'issue'
