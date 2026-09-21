import { createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function loadGitHubVendorConfig(environment = process.env, readFile = readFileSync) {
  const values = {
    appId: String(environment.MACHINE_GITHUB_APP_ID || '').trim(),
    appSlug: String(environment.MACHINE_GITHUB_APP_SLUG || '').trim(),
    clientId: String(environment.MACHINE_GITHUB_CLIENT_ID || '').trim(),
    clientSecret: String(environment.MACHINE_GITHUB_CLIENT_SECRET || ''),
    privateKeyPath: String(environment.MACHINE_GITHUB_PRIVATE_KEY_PATH || '').trim()
  };
  const issues = [];
  if (!/^\d+$/.test(values.appId)) issues.push('MACHINE_GITHUB_APP_ID');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(values.appSlug)) issues.push('MACHINE_GITHUB_APP_SLUG');
  if (!/^(?:Iv|Ov|lv)[A-Za-z0-9.]{8,}$/.test(values.clientId)) issues.push('MACHINE_GITHUB_CLIENT_ID');
  if (values.clientSecret.length < 20) issues.push('MACHINE_GITHUB_CLIENT_SECRET');
  let privateKey = null;
  if (!values.privateKeyPath) issues.push('MACHINE_GITHUB_PRIVATE_KEY_PATH');
  else {
    try {
      privateKey = readFile(values.privateKeyPath, 'utf8');
      createPrivateKey(privateKey);
    } catch {
      issues.push('MACHINE_GITHUB_PRIVATE_KEY_PATH (unreadable or invalid PEM)');
      privateKey = null;
    }
  }
  return {
    configured: issues.length === 0,
    issues,
    appId: values.appId,
    appSlug: values.appSlug,
    clientId: values.clientId,
    clientSecret: values.clientSecret,
    privateKey
  };
}
