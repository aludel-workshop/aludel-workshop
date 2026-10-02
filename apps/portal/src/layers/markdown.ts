// A generated or written document's Markdown, as blocks of text and record mentions ([[id]]) the template renders as chips.
type Inline = { text?: string; ref?: string; strong?: boolean; em?: boolean };
type Block = { tag: 'h1' | 'h2' | 'p' | 'ul'; parts: Inline[]; items?: Inline[][] };
const inline = (value: string): Inline[] => value.split(/(\[\[[a-z]+-[a-z0-9]+\]\]|\*\*[^*]+\*\*|_[^_]+_)/).filter(Boolean).map(part =>
  part.startsWith('[[') ? { ref: part.slice(2, -2) } : part.startsWith('**') ? { text: part.slice(2, -2), strong: true } : /^_[^_]+_$/.test(part) ? { text: part.slice(1, -1), em: true } : { text: part });
export function markdownBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.split(/\n\s*\n/)) {
    const text = chunk.trim(); if (!text) continue;
    if (text.startsWith('# ')) blocks.push({ tag: 'h1', parts: inline(text.slice(2)) });
    else if (text.startsWith('## ')) blocks.push({ tag: 'h2', parts: inline(text.slice(3)) });
    else if (text.split('\n').every(line => line.trim().startsWith('- '))) blocks.push({ tag: 'ul', parts: [], items: text.split('\n').map(line => inline(line.trim().slice(2))) });
    else blocks.push({ tag: 'p', parts: inline(text.replace(/\n/g, ' ')) });
  }
  return blocks;
}
