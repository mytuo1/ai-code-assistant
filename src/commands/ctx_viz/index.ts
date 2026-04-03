/** Internal command stub: ctx_viz — not available in this deployment */
import type { Command } from '../../types/command.js'

const command = {
  name: '/ctx_viz',
  description: 'ctx_viz — not available',
  isEnabled: () => false,
  isHidden: true,
  type: 'local',
  call: async () => ({ type: 'text', value: 'Not available.' }),
} as unknown as Command

export default command
// Extra named exports some files may use
export const resetRateLimits = (): void => {}
export const resetExtraUsage = (): void => {}
export const COMMAND_NAME = 'ctx_viz'
