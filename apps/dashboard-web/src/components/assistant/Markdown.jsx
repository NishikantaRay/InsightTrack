/**
 * Tiny, dependency-free markdown renderer for Pulse's chat replies.
 * Covers what LLMs actually emit: **bold**, *italic*, `code`, [link](url),
 * bullet / numbered lists, and ### headings. Everything is built as React
 * nodes (never innerHTML), so model output can't inject markup.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\n]+\*)/g;

function inlineNodes(text) {
    return text.split(INLINE).filter(Boolean).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return (
                <code key={i} className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10 font-mono text-[0.88em]">
                    {part.slice(1, -1)}
                </code>
            );
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link && /^(https?:\/\/|\/)/.test(link[2])) {
            return (
                <a key={i} href={link[2]} target="_blank" rel="noreferrer" className="text-accent underline hover:no-underline">
                    {link[1]}
                </a>
            );
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return part;
    });
}

export default function Markdown({ text }) {
    const lines = String(text ?? '').split('\n');
    const blocks = [];
    let list = null;
    const flush = () => { if (list) { blocks.push(list); list = null; } };

    for (const line of lines) {
        const bullet = line.match(/^\s*[*+-]\s+(.*)$/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
        const heading = line.match(/^\s*(#{1,4})\s+(.*)$/);
        if (bullet) {
            if (!list || list.type !== 'ul') { flush(); list = { type: 'ul', items: [] }; }
            list.items.push(bullet[1]);
        } else if (numbered) {
            if (!list || list.type !== 'ol') { flush(); list = { type: 'ol', items: [] }; }
            list.items.push(numbered[1]);
        } else if (heading) {
            flush();
            blocks.push({ type: 'h', text: heading[2] });
        } else if (!line.trim()) {
            flush();
        } else {
            flush();
            blocks.push({ type: 'p', text: line });
        }
    }
    flush();

    return (
        <>
            {blocks.map((b, i) => {
                if (b.type === 'ul' || b.type === 'ol') {
                    const List = b.type;
                    return (
                        <List key={i} className={`${b.type === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 my-1.5 space-y-1`}>
                            {b.items.map((item, j) => <li key={j}>{inlineNodes(item)}</li>)}
                        </List>
                    );
                }
                if (b.type === 'h') {
                    return <p key={i} className="font-semibold mt-2.5 mb-1">{inlineNodes(b.text)}</p>;
                }
                return <p key={i} className="my-1.5 first:mt-0 last:mb-0">{inlineNodes(b.text)}</p>;
            })}
        </>
    );
}
