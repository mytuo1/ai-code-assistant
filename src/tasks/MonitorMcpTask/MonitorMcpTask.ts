export class MonitorMcpTask {
  constructor(_config: unknown) {}
  async run(): Promise<void> {}
  async stop(): Promise<void> {}
}
export default MonitorMcpTask

export type MonitorMcpTaskState = { status: 'idle' | 'monitoring' | 'done' }
