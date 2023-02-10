/**
 * The Implementation of OpenID Connect of Line.
 * https://developers.line.biz/en/reference/line-login
 */
import type {
  CreateConnector,
  GetAuthorizationUri,
  GetConnectorConfig,
  GetUserInfo,
  SocialConnector,
} from '@logto/connector-kit';
import {
  ConnectorType,
  ConnectorError,
  ConnectorErrorCodes,
  parseJson,
  validateConfig,
} from '@logto/connector-kit';
import { assert, conditional } from '@silverhand/essentials';
import { got, HTTPError } from 'got';

import {
  accessTokenEndpoint,
  authorizationEndpoint,
  defaultMetadata,
  defaultTimeout,
  scope,
  userInfoEndpoint,
  verifyIdTokenEndpoint,
} from './constant.js';
import type { LineConfig } from './types.js';
import {
  authErrorGuard,
  idTokenResponseGuard,
  userInfoResponseGuard,
  authResponseGuard,
  accessTokenResponseGuard,
  lineConfigGuard,
} from './types.js';

const getAuthorizationUri =
  (getConfig: GetConnectorConfig): GetAuthorizationUri =>
  async ({ state, redirectUri }) => {
    const config = await getConfig(defaultMetadata.id);
    validateConfig<LineConfig>(config, lineConfigGuard);

    const queryParameters = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope,
    });

    return `${authorizationEndpoint}?${queryParameters.toString()}`;
  };

export const getAccessToken = async (
  config: LineConfig,
  codeObject: { code: string; redirectUri: string }
) => {
  const { code, redirectUri } = codeObject;
  const { clientId, clientSecret } = config;

  const httpResponse = await got.post(accessTokenEndpoint, {
    form: {
      code: decodeURIComponent(code),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    },
    timeout: { request: defaultTimeout },
  });

  const result = accessTokenResponseGuard.safeParse(parseJson(httpResponse.body));

  if (!result.success) {
    throw new ConnectorError(ConnectorErrorCodes.InvalidResponse, result.error);
  }

  const { access_token: accessToken, id_token: idToken } = result.data;

  assert(accessToken, new ConnectorError(ConnectorErrorCodes.SocialAccessTokenInvalid));
  assert(idToken, new ConnectorError(ConnectorErrorCodes.SocialIdTokenInvalid));

  return { accessToken, idToken };
};

const getUserInfo =
  (getConfig: GetConnectorConfig): GetUserInfo =>
  async (data) => {
    const { code, redirectUri } = await authorizationCallbackHandler(data);
    const config = await getConfig(defaultMetadata.id);
    validateConfig<LineConfig>(config, lineConfigGuard);
    const { accessToken, idToken } = await getAccessToken(config, { code, redirectUri });

    try {
      const userInfoHttpResponse = await got.get(userInfoEndpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: { request: defaultTimeout },
      });

      const userInfoResult = userInfoResponseGuard.safeParse(parseJson(userInfoHttpResponse.body));

      if (!userInfoResult.success) {
        throw new ConnectorError(ConnectorErrorCodes.InvalidResponse, userInfoResult.error);
      }

      const { userId, displayName, pictureUrl } = userInfoResult.data;

      const idTokenHttpResponse = await got.post(verifyIdTokenEndpoint, {
        form: {
          id_token: idToken,
          client_id: config.clientId,
        },
        timeout: { request: defaultTimeout },
      });

      const idTokenResult = idTokenResponseGuard.safeParse(parseJson(idTokenHttpResponse.body));

      if (!idTokenResult.success) {
        throw new ConnectorError(ConnectorErrorCodes.InvalidResponse, idTokenResult.error);
      }

      const { email } = idTokenResult.data;

      return {
        id: userId,
        avatar: conditional(pictureUrl),
        email: conditional(email),
        name: displayName,
      };
    } catch (error: unknown) {
      return getUserInfoErrorHandler(error);
    }
  };

const authorizationCallbackHandler = async (parameterObject: unknown) => {
  const result = authResponseGuard.safeParse(parameterObject);

  if (!result.success) {
    const error = authErrorGuard.safeParse(parameterObject);

    if (error.success && error.data.error === 'ACCESS_DENIED') {
      throw new ConnectorError(ConnectorErrorCodes.AuthorizationFailed);
    }

    throw new ConnectorError(ConnectorErrorCodes.General, JSON.stringify(parameterObject));
  }

  return result.data;
};

const getUserInfoErrorHandler = (error: unknown) => {
  if (error instanceof HTTPError) {
    const { statusCode, body: rawBody } = error.response;

    if (statusCode === 401) {
      throw new ConnectorError(ConnectorErrorCodes.SocialAccessTokenInvalid);
    }

    throw new ConnectorError(ConnectorErrorCodes.General, JSON.stringify(rawBody));
  }

  throw error;
};

const createLineConnector: CreateConnector<SocialConnector> = async ({ getConfig }) => {
  return {
    metadata: defaultMetadata,
    type: ConnectorType.Social,
    configGuard: lineConfigGuard,
    getAuthorizationUri: getAuthorizationUri(getConfig),
    getUserInfo: getUserInfo(getConfig),
  };
};

export default createLineConnector;
