import type { Command, LocalCommandCall } from '../types/command.js'

const call: LocalCommandCall = async () => {
  return {
    type: 'text',
    value: ({VERSION:"1.0.0",PACKAGE_URL:process.env.PACKAGE_NAME??"ai-code-assistant"}).BUILD_TIME
      ? `${"1.0.0"} (built ${({VERSION:"1.0.0",PACKAGE_URL:process.env.PACKAGE_NAME??"ai-code-assistant"}).BUILD_TIME})`
      : "1.0.0",
  }
}

const version = {
  type: 'local',
  name: 'version',
  description:
    'Print the version this session is running (not what autoupdate downloaded)',
  isEnabled: () => process.env.USER_TYPE === 'ant',
  supportsNonInteractive: true,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default version
