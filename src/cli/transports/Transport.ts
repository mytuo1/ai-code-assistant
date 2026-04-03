export interface Transport {
  send(data: unknown): Promise<void>
  receive(): Promise<unknown>
  close(): Promise<void>
}
export abstract class BaseTransport implements Transport {
  abstract send(data: unknown): Promise<void>
  abstract receive(): Promise<unknown>
  abstract close(): Promise<void>
}
