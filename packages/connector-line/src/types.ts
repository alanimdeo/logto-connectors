import { z } from 'zod';

export const lineConfigGuard = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
});

export type LineConfig = z.infer<typeof lineConfigGuard>;

export const accessTokenResponseGuard = z.object({
  access_token: z.string(),
  id_token: z.string(),
  scope: z.string(),
  token_type: z.string(),
});

export type AccessTokenResponse = z.infer<typeof accessTokenResponseGuard>;

export const userInfoResponseGuard = z.object({
  userId: z.string(),
  displayName: z.string(),
  pictureUrl: z.string().optional(),
});

export type UserInfoResponse = z.infer<typeof userInfoResponseGuard>;

export const idTokenResponseGuard = z.object({
  email: z.string().optional(),
});

export type IdTokenResponse = z.infer<typeof idTokenResponseGuard>;

export const authResponseGuard = z.object({
  code: z.string(),
  redirectUri: z.string(),
});
