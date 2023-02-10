import { ConnectorError, ConnectorErrorCodes } from '@logto/connector-kit';
import nock from 'nock';

import {
  accessTokenEndpoint,
  authorizationEndpoint,
  userInfoEndpoint,
  verifyIdTokenEndpoint,
} from './constant.js';
import createConnector, { getAccessToken } from './index.js';
import { mockedConfig } from './mock.js';

const { jest } = import.meta;

const getConfig = jest.fn().mockResolvedValue(mockedConfig);

describe('line connector', () => {
  describe('getAuthorizationUri', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should get a valid authorizationUri with redirectUri and state', async () => {
      const connector = await createConnector({ getConfig });
      const authorizationUri = await connector.getAuthorizationUri({
        state: 'some_state',
        redirectUri: 'http://localhost:3000/callback',
        connectorId: 'some_connector_id',
        connectorFactoryId: 'some_connector_factory_id',
        jti: 'some_jti',
        headers: {},
      });
      expect(authorizationUri).toEqual(
        `${authorizationEndpoint}?client_id=%3Cclient-id%3E&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&response_type=code&state=some_state&scope=profile+openid+email`
      );
    });
  });

  describe('getAccessToken', () => {
    afterEach(() => {
      nock.cleanAll();
      jest.clearAllMocks();
    });

    it('should get an accessToken by exchanging with code', async () => {
      nock(accessTokenEndpoint).post('').reply(200, {
        access_token: 'access_token',
        id_token: 'id_token',
        scope: 'scope',
        token_type: 'token_type',
      });
      const { accessToken } = await getAccessToken(mockedConfig, {
        code: 'code',
        redirectUri: 'dummyRedirectUri',
      });
      expect(accessToken).toEqual('access_token');
    });

    it('throws SocialAccessTokenInvalid error if accessToken not found in response', async () => {
      nock(accessTokenEndpoint).post('').reply(200, {
        access_token: '',
        id_token: 'id_token',
        scope: 'scope',
        token_type: 'token_type',
      });
      await expect(
        getAccessToken(mockedConfig, { code: 'code', redirectUri: 'dummyRedirectUri' })
      ).rejects.toMatchError(new ConnectorError(ConnectorErrorCodes.SocialAccessTokenInvalid));
    });

    it('throws SocialIdTokenInvalid error if idToken not found in response', async () => {
      nock(accessTokenEndpoint).post('').reply(200, {
        access_token: 'access_token',
        id_token: '',
        scope: 'scope',
        token_type: 'token_type',
      });
      await expect(
        getAccessToken(mockedConfig, { code: 'code', redirectUri: 'dummyRedirectUri' })
      ).rejects.toMatchError(new ConnectorError(ConnectorErrorCodes.SocialIdTokenInvalid));
    });
  });

  describe('getUserInfo', () => {
    beforeEach(() => {
      nock(accessTokenEndpoint).post('').reply(200, {
        access_token: 'access_token',
        id_token: 'id_token',
        scope: 'scope',
        token_type: 'token_type',
      });
    });

    afterEach(() => {
      nock.cleanAll();
      jest.clearAllMocks();
    });

    it('should get valid SocialUserInfo', async () => {
      nock(userInfoEndpoint).get('').reply(200, {
        userId: 'U1234567890abcdef1234567890abcdef',
        displayName: 'Brown',
        pictureUrl: 'https://profile.line-scdn.net/abcdefghijklmn',
        statusMessage: 'Hello, LINE!',
      });
      nock(verifyIdTokenEndpoint)
        .post('')
        .reply(200, {
          iss: 'https://access.line.me',
          sub: 'U1234567890abcdef1234567890abcdef',
          aud: '<client-id>',
          exp: 1_504_169_092,
          iat: 1_504_263_657,
          amr: ['pwd'],
          name: 'Brown',
          picture: 'https://profile.line-scdn.net/abcdefghijklmn',
          email: 'brown@example.com',
        });
      const connector = await createConnector({ getConfig });
      const socialUserInfo = await connector.getUserInfo({
        code: 'code',
        redirectUri: 'redirectUri',
      });
      expect(socialUserInfo).toMatchObject({
        id: 'U1234567890abcdef1234567890abcdef',
        avatar: 'https://profile.line-scdn.net/abcdefghijklmn',
        name: 'Brown',
        email: 'brown@example.com',
      });
    });

    it('throws SocialAccessTokenInvalid error if remote response code is 401', async () => {
      nock(userInfoEndpoint).get('').reply(401);
      const connector = await createConnector({ getConfig });
      await expect(connector.getUserInfo({ code: 'code', redirectUri: '' })).rejects.toMatchError(
        new ConnectorError(ConnectorErrorCodes.SocialAccessTokenInvalid)
      );
    });

    it('throws General error', async () => {
      nock(userInfoEndpoint).get('').reply(200, {
        userId: 'U1234567890abcdef1234567890abcdef',
        displayName: 'Brown',
        pictureUrl: 'https://profile.line-scdn.net/abcdefghijklmn',
        statusMessage: 'Hello, LINE!',
      });
      nock(verifyIdTokenEndpoint)
        .post('')
        .reply(200, {
          iss: 'https://access.line.me',
          sub: 'U1234567890abcdef1234567890abcdef',
          aud: '<client-id>',
          exp: 1_504_169_092,
          iat: 1_504_263_657,
          amr: ['pwd'],
          name: 'Brown',
          picture: 'https://profile.line-scdn.net/abcdefghijklmn',
          email: 'brown@example.com',
        });
      const connector = await createConnector({ getConfig });
      await expect(
        connector.getUserInfo({
          error: 'general_error',
          error_description: 'General error encountered.',
        })
      ).rejects.toMatchError(
        new ConnectorError(
          ConnectorErrorCodes.General,
          '{"error":"general_error","error_description":"General error encountered."}'
        )
      );
    });

    it('throws unrecognized error', async () => {
      nock(userInfoEndpoint).post('').reply(500);
      const connector = await createConnector({ getConfig });
      await expect(connector.getUserInfo({ code: 'code', redirectUri: '' })).rejects.toThrow();
    });
  });
});
