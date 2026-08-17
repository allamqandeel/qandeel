export interface AuthenticatedUser {
  userId: string;
  accessToken: string;
}

export interface AuthenticatedRequest {
  headers: { authorization?: string | string[] };
  authenticatedUser: AuthenticatedUser;
}
