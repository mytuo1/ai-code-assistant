export class LocalWorkflowTask {
  constructor(_config: unknown) {}
  async run(): Promise<void> {}
  async stop(): Promise<void> {}
}
export default LocalWorkflowTask

export type LocalWorkflowTaskState = { status: 'idle' | 'running' | 'done' | 'error' }
