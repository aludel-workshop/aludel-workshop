import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const mimeExtensions = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp']
]);
const brandSelect = `id, slug, name, description, tagline, accent_color, hero_image_path, updated_at`;

export function getProjectBrand(db, projectId) {
  return db.prepare(`SELECT ${brandSelect} FROM projects WHERE id = ?`).get(projectId) || null;
}

export function updateProjectBrand(db, assetRoot, projectId, input) {
  const current = getProjectBrand(db, projectId);
  if (!current) return null;
  const name = String(input.name ?? current.name).trim();
  const description = String(input.description ?? current.description).trim();
  const tagline = String(input.tagline ?? current.tagline).trim();
  const accentColor = String(input.accentColor ?? current.accent_color).trim().toLowerCase();
  if (!name || name.length > 80) throw Object.assign(new Error('Project name must be between 1 and 80 characters.'), { status: 400 });
  if (description.length > 280 || tagline.length > 120) throw Object.assign(new Error('Brand description or tagline is too long.'), { status: 400 });
  if (!/^#[0-9a-f]{6}$/.test(accentColor)) throw Object.assign(new Error('Accent color must be a six-digit hex color.'), { status: 400 });

  let heroImagePath = current.hero_image_path;
  if (input.heroImageDataUrl) {
    const match = /^data:([^;]+);base64,([a-z0-9+/=]+)$/i.exec(String(input.heroImageDataUrl));
    const extension = match && mimeExtensions.get(match[1].toLowerCase());
    if (!match || !extension) throw Object.assign(new Error('Artwork must be a PNG, JPEG, or WebP image.'), { status: 400 });
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw Object.assign(new Error('Artwork must be no larger than 8 MB.'), { status: 413 });
    const directory = join(assetRoot, projectId);
    mkdirSync(directory, { recursive: true });
    const filename = `${createHash('sha256').update(bytes).digest('hex').slice(0, 20)}.${extension}`;
    const assetPath = join(directory, filename);
    if (!existsSync(assetPath)) writeFileSync(assetPath, bytes, { flag: 'wx' });
    heroImagePath = `/brand-assets/${encodeURIComponent(projectId)}/${filename}`;
  }
  const now = new Date().toISOString();
  db.prepare(`UPDATE projects SET name = ?, description = ?, tagline = ?, accent_color = ?, hero_image_path = ?, updated_at = ? WHERE id = ?`)
    .run(name, description, tagline, accentColor, heroImagePath, now, projectId);
  return getProjectBrand(db, projectId);
}
