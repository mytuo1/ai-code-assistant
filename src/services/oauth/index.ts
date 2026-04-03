/** OAuth service — stubbed. No OAuth flows in this deployment. */
export class OAuthService {
  static async login(): Promise<void> {}
  static async logout(): Promise<void> {}
  static isLoggedIn(): boolean { return false }
}
