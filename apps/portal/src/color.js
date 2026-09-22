// Shared by the onboarding preview (browser) and the scaffold (server) so both derive identical theme colours.
const channels = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const toHex = values => `#${values.map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
const luminance = hex => {
  const [r, g, b] = channels(hex).map(value => value / 255).map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (a, b) => { const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (light + 0.05) / (dark + 0.05); };

// Whichever of black or white text reads better on the given colour.
export function contrastText(hex) {
  return contrastRatio(hex, '#000000') >= contrastRatio(hex, '#ffffff') ? '#000000' : '#ffffff';
}

// The chosen accent stays the brand colour, but the primary role is also used for text on the surface,
// so shift it toward black (light surfaces) or white (dark surfaces) until it meets WCAG AA 4.5:1.
export function readableAccent(accent, surface) {
  const target = luminance(surface) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  const source = channels(accent);
  for (let step = 0; step <= 20; step++) {
    const candidate = toHex(source.map((value, index) => value + (target[index] - value) * step / 20));
    if (contrastRatio(candidate, surface) >= 4.5) return candidate;
  }
  return toHex(target);
}
