import { createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';

const committedPath = new URL('../config/github-app.json', import.meta.url);

// The App's public identifiers come from committed config (config/github-app.json), so the repository always records which
// App the portal uses. Only the client secret and the private key are secrets, and they come from the environment alone.
// Environment variables override the committed identifiers (another deployment, or tests).
export function loadGitHubVendorConfig(environment = process.env, readFile = readFileSync, committed = readCommitted(readFile)) {
  const pick = (variable, key) => String(environment[variable] || committed[key] || '').trim();
  const values = {
    appId: pick('MACHINE_GITHUB_APP_ID', 'appId'),
    appSlug: pick('MACHINE_GITHUB_APP_SLUG', 'appSlug'),
    clientId: pick('MACHINE_GITHUB_CLIENT_ID', 'clientId'),
    clientSecret: String(environment.MACHINE_GITHUB_CLIENT_SECRET || ''),
    privateKeyPath: String(environment.MACHINE_GITHUB_PRIVATE_KEY_PATH || '').trim()
  };
  const issues = [];
  if (!/^\d+$/.test(values.appId)) issues.push('appId in config/github-app.json (or MACHINE_GITHUB_APP_ID)');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(values.appSlug)) issues.push('appSlug in config/github-app.json (or MACHINE_GITHUB_APP_SLUG)');
  if (!/^(?:Iv|Ov|lv)[A-Za-z0-9.]{8,}$/.test(values.clientId)) issues.push('clientId in config/github-app.json (or MACHINE_GITHUB_CLIENT_ID)');
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
  // Where GitHub answers: github.com by default, a GitHub Enterprise Server's own addresses, or a fake GitHub in browser
  // journeys (EX-02A C1). Plain http is only accepted for loopback addresses.
  const base = (variable, fallback) => {
    const value = String(environment[variable] || fallback).trim().replace(/\/+$/, '');
    try { const url = new URL(value); if (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) return value; } catch { /* reported below */ }
    issues.push(`${variable} (an https address, or http on loopback)`);
    return fallback;
  };
  const apiUrl = base('MACHINE_GITHUB_API_URL', 'https://api.github.com');
  const webUrl = base('MACHINE_GITHUB_WEB_URL', 'https://github.com');
  return {
    configured: issues.length === 0,
    apiUrl, webUrl,
    issues,
    appId: values.appId,
    appSlug: values.appSlug,
    clientId: values.clientId,
    clientSecret: values.clientSecret,
    privateKey
  };
}

function readCommitted(readFile) {
  try { return JSON.parse(readFile(committedPath, 'utf8')); }
  catch { return {}; }
}
