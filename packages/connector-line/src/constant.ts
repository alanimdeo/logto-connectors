import type { ConnectorMetadata } from '@logto/connector-kit';
import { ConnectorPlatform } from '@logto/connector-kit';

export const authorizationEndpoint = 'https://access.line.me/oauth2/v2.1/authorize';
export const accessTokenEndpoint = 'https://api.line.me/oauth2/v2.1/token';
export const userInfoEndpoint = 'https://api.line.me/v2/profile';
export const verifyIdTokenEndpoint = 'https://api.line.me/oauth2/v2.1/verify';
export const scope = 'profile openid email';

export const defaultMetadata: ConnectorMetadata = {
  id: 'line-universal',
  target: 'line',
  platform: ConnectorPlatform.Universal,
  name: {
    en: 'Line',
    'zh-CN': 'Line',
    'tr-TR': 'Line',
    ko: '라인',
  },
  logo: './logo.svg',
  logoDark: null,
  description: {
    en: 'Line',
  },
  readme: './README.md',
  configTemplate: './docs/config-template.json',
};

export const defaultTimeout = 5000;
