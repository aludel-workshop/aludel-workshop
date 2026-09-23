// WORK-UX-01: avatars drawn locally with DiceBear (MIT). Agents are "Bottts Neutral" robots (Pablo Stanley, free for
// personal and commercial use) on their profile's metal tone; people are "Big Smile" faces (Ashley Seo, CC BY 4.0) they
// build themselves. Nothing is fetched: each avatar is an SVG data URI, cached by its options.
import { createAvatar } from '@dicebear/core';
import * as bigSmile from '@dicebear/big-smile';
import * as botttsNeutral from '@dicebear/bottts-neutral';
import type { PersonAvatar } from './layers/context';

const cache = new Map<string, string>();
const memo = (key: string, make: () => string) => { let value = cache.get(key); if (!value) { value = make(); cache.set(key, value); } return value; };

export function botAvatar(seed: string, color: string) {
  return memo(`bot:${seed}:${color}`, () => createAvatar(botttsNeutral, { seed, backgroundColor: [color.replace('#', '')], radius: 18 }).toDataUri());
}

// A person's avatar: their saved choices, or a face seeded from their name until they make one.
export function personAvatar(avatar: PersonAvatar | null | undefined, fallbackSeed: string) {
  const options = avatar || {};
  const key = `person:${fallbackSeed}:${JSON.stringify(options)}`;
  return memo(key, () => {
    // Only the parts the person chose are passed; an undefined option would replace the style's default and draw nothing.
    const chosen: Record<string, unknown> = { seed: options.seed || fallbackSeed, radius: 50, backgroundColor: [options.backgroundColor || 'dfe5ff'],
      accessoriesProbability: options.accessoriesProbability ?? (options.accessories ? 100 : 0) };
    for (const key of ['skinColor', 'hair', 'hairColor', 'eyes', 'mouth', 'accessories'] as const) if (options[key]) chosen[key] = [options[key]];
    return createAvatar(bigSmile, chosen as Parameters<typeof createAvatar<typeof bigSmile>>[1]).toDataUri();
  });
}

// The editor's choices, straight from the style's own schema, so it offers exactly what the style can draw.
type SchemaProperty = { items?: { enum?: string[] }; default?: string[] };
const property = (name: string) => (bigSmile.schema.properties as Record<string, SchemaProperty>)[name];
export const bigSmileChoices = {
  hair: property('hair')?.items?.enum || [],
  eyes: property('eyes')?.items?.enum || [],
  mouth: property('mouth')?.items?.enum || [],
  accessories: property('accessories')?.items?.enum || [],
  hairColor: property('hairColor')?.default || [],
  skinColor: property('skinColor')?.default || [],
  backgroundColor: ['dfe5ff', 'efe7ff', 'ffe4ee', 'd9f3ec', 'fff0d4', 'dcf0fb', 'e3e7ef', 'f6f7fb']
};
export const avatarCredits = {
  person: { title: 'Big Smile', creator: 'Ashley Seo', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', source: 'https://www.figma.com/community/file/881358461963645496' },
  bot: { title: 'Bottts', creator: 'Pablo Stanley', license: 'Free for personal and commercial use', source: 'https://bottts.com/' }
};
// "shortHair" → "Short hair"
export const optionLabel = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, first => first.toUpperCase()).replace(/ ([A-Z])/g, (_, letter) => ` ${letter.toLowerCase()}`);
