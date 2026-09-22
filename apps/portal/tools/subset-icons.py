#!/usr/bin/env python3
"""Rebuild the Material Symbols subset from the icon names the portal actually uses.

Requires fontTools (`pip install fonttools brotli`). Run from apps/portal:

    python3 tools/subset-icons.py

It scans src/ templates and components plus config/*.json "icon" values, instantiates the
variable font at its defaults, keeps only those ligatures, and writes the font and
src/icon-subset.json. tests/icon-subset.test.mjs fails when a used name is missing from the manifest.
"""
import json
import pathlib
import re

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

root = pathlib.Path(__file__).resolve().parents[1]
source = root / 'node_modules/material-symbols/material-symbols-rounded.woff2'
target = root / 'src/material-symbols-rounded-subset.ttf'
manifest = root / 'src/icon-subset.json'
# Generated apps get their own small subset: only the icons a page can be given in onboarding.
app_target = root / 'templates/aludel-web-v1/icons.ttf'


def used_names():
    names, candidates = set(), set()
    for path in (root / 'src').rglob('*'):
        if path.suffix not in {'.html', '.ts'} or path.name.endswith('.stories.ts'):
            continue
        text = path.read_text(encoding='utf8')
        names.update(re.findall(r'<mat-icon[^>]*>\s*([a-z0-9_]+)\s*</mat-icon>', text))
        names.update(re.findall(r'icon:\s*[\'"]([a-z0-9_]+)[\'"]', text))
        # Quoted words inside {{ ... }} icon expressions may be icons or compared state values; keep only real glyphs.
        for dynamic in re.findall(r'<mat-icon[^>]*>\s*\{\{(.*?)\}\}\s*</mat-icon>', text):
            candidates.update(re.findall(r"'([a-z0-9_]+)'", dynamic))
    for path in (root / 'config').glob('*.json'):
        names.update(re.findall(r'"icon":\s*"([a-z0-9_]+)"', path.read_text(encoding='utf8')))
    return sorted(names), candidates


def build(names, target):
    font = TTFont(source)
    font = instancer.instantiateVariableFont(font, {axis.axisTag: axis.defaultValue for axis in font['fvar'].axes})
    options = subset.Options()
    options.layout_features = ['liga', 'rlig', 'calt', 'ccmp']
    options.layout_closure = False  # keep only ligatures for the listed icons, not every icon spelled from the same letters
    options.flavor = None
    subsetter = subset.Subsetter(options)
    subsetter.populate(glyphs=names, text=''.join(sorted(set(''.join(names)) | {' '})))
    subsetter.subset(font)
    target.parent.mkdir(parents=True, exist_ok=True)
    font.save(target)


def main():
    names, candidates = used_names()
    font = TTFont(source)
    names = sorted(set(names) | (candidates & set(font.getGlyphOrder())))
    missing = [name for name in names if name not in set(font.getGlyphOrder())]
    if missing:
        raise SystemExit(f'Not Material Symbols names: {", ".join(missing)}')
    build(names, target)
    route_icons = [item['icon'] for item in json.loads((root / 'config/starter-kit.json').read_text(encoding='utf8'))['routeIcons']]
    build(route_icons, app_target)
    manifest.write_text(json.dumps({'source': 'material-symbols 0.40.2 rounded (default axes)', 'icons': names, 'appIcons': route_icons}, indent=2) + '\n', encoding='utf8')
    print(f'{len(names)} icons, {target.stat().st_size} bytes -> {target.relative_to(root)}')
    print(f'{len(route_icons)} app icons, {app_target.stat().st_size} bytes -> {app_target.relative_to(root)}')


if __name__ == '__main__':
    main()
