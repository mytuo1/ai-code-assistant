export type OAuthConfig = {
  clientId: string
  redirectUri: string
  scopes: string[]
}
export type OAuthTokens = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}
