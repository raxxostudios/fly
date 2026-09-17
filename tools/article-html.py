"""Convert the X article Markdown into rich HTML for pasting into X's editor.

X Articles cannot show tables, so the results table becomes a short list and
the recorded results figure. Media positions become marker paragraphs such
as [[MEDIA film]] that the editing session replaces with uploads.
Usage: python3 tools/article-html.py <article.md> <out.html>
The first heading is dropped (it goes into X's title field).
"""
import html, re, sys

src, out = sys.argv[1], sys.argv[2]
lines = open(src, encoding='utf-8').read().split('\n')

def inline(text):
    parts = re.split(r'(\[[^\]]+\]\([^)]+\))', text)
    res = []
    for p in parts:
        m = re.fullmatch(r'\[([^\]]+)\]\(([^)]+)\)', p)
        if m:
            res.append(f'<a href="{html.escape(m.group(2), quote=True)}">{fmt(m.group(1))}</a>')
        else:
            res.append(fmt(p))
    return ''.join(res)

def fmt(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', r'\1', t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', t)
    return t

blocks, i, title_done, para = [], 0, False, []
def flush():
    if para:
        blocks.append(f'<p>{inline(" ".join(para))}</p>')
        para.clear()

while i < len(lines):
    line = lines[i].rstrip()
    if line.startswith('# ') and not title_done:
        title_done = True; i += 1; continue
    if line.startswith('[[MEDIA'):
        flush(); blocks.append(f'<p>{html.escape(line)}</p>'); i += 1; continue
    if line.startswith('## '):
        flush(); blocks.append(f'<h2>{inline(line[3:])}</h2>'); i += 1; continue
    if line.startswith('|'):
        flush()
        rows = []
        while i < len(lines) and lines[i].startswith('|'):
            cells = [c.strip() for c in lines[i].strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?', c) for c in cells):
                rows.append(cells)
            i += 1
        head, body = rows[0], rows[1:]
        items = ''.join(f'<li><strong>{inline(r[0])}:</strong> {inline(r[1])} ({inline(head[1]).lower()}), {inline(r[2])} ({inline(head[2]).lower()})</li>' for r in body)
        blocks.append(f'<ul>{items}</ul>')
        blocks.append('<p>[[MEDIA result]]</p>')
        continue
    if re.match(r'^[-*] ', line):
        flush()
        items = []
        while i < len(lines) and re.match(r'^[-*] ', lines[i]):
            items.append(f'<li>{inline(lines[i][2:].strip())}</li>'); i += 1
        blocks.append(f'<ul>{"".join(items)}</ul>')
        continue
    if not line.strip():
        flush(); i += 1; continue
    para.append(line.strip()); i += 1
flush()
doc = '<meta charset="utf-8">' + ''.join(blocks)
assert '—' not in doc, 'em dash in article'
open(out, 'w', encoding='utf-8').write(doc)
print(len(blocks), 'blocks', len(re.sub('<[^>]+>', ' ', doc).split()), 'words')
