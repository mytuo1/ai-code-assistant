export class SSHSessionManager {
  async connect(_host: string, _opts?: unknown): Promise<void> {}
  async disconnect(): Promise<void> {}
  async exec(_cmd: string): Promise<string> { return '' }
}
