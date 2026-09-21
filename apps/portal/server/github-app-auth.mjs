import { createSign } from 'node:crypto';

const apiVersion = '2022-11-28';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

export function createAppJwt(config, clock = () => Date.now()) {
  if (!config.configured || !config.privateKey) throw Object.assign(new Error('The vendor GitHub App is not configured.'), { status: 503 });
  const current = Math.floor(clock() / 1000);
  const input = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: current - 60, exp: current + 9 * 60, iss: config.appId })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  return `${input}.${signer.sign(config.privateKey).toString('base64url')}`;
}

export async function mintInstallationToken(config, installationId, { permissions, repositories } = {}, fetcher = fetch, clock) {
  const body = {};
  if (permissions) body.permissions = permissions;
  if (repositories?.length) body.repositories = repositories;
  const response = await fetcher(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json', authorization: `Bearer ${createAppJwt(config, clock)}`,
      'content-type': 'application/json', 'x-github-api-version': apiVersion, 'user-agent': 'aludel-portal'
    },
    body: JSON.stringify(body)
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok || !value.token) throw Object.assign(new Error(value.message || 'GitHub installation token creation failed.'), { status: 502 });
  return { token: value.token, expiresAt: value.expires_at };
}
