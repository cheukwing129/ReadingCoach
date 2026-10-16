"""Verify actual tagged PDF table pagination after exam-export-browser-smoke.cjs."""
import json
import sys
from pathlib import Path

import fitz
from pypdf import PdfReader
from pypdf.generic import IndirectObject


def resolve(value):
    return value.get_object() if isinstance(value, IndirectObject) else value


def page_key(value):
    return (value.idnum, value.generation) if isinstance(value, IndirectObject) else None


def content_pages(node, inherited_page=None):
    node = resolve(node)
    if isinstance(node, list):
        return set().union(*(content_pages(child, inherited_page) for child in node))
    if isinstance(node, dict):
        page = node.get('/Pg', inherited_page)
        if '/MCID' in node:
            return {page_key(page)}
        return content_pages(node.get('/K', []), page)
    if isinstance(node, int):
        return {page_key(inherited_page)}
    return set()


def tables(node, inherited_page=None):
    node = resolve(node)
    if isinstance(node, list):
        for child in node:
            yield from tables(child, inherited_page)
    elif isinstance(node, dict):
        page = node.get('/Pg', inherited_page)
        if node.get('/S') == '/Table':
            yield content_pages(node, page)
        yield from tables(node.get('/K', []), page)


directory = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/readingcoach-export-qa')
manifest = json.loads((directory / 'layout-manifest.json').read_text())
original_tables = 0
reports = []
for path in sorted(directory.glob('*.pdf')):
    reader = PdfReader(path)
    structure = reader.trailer['/Root'].get('/StructTreeRoot')
    assert structure, f'{path.name}: tagged PDF structure is missing'
    table_pages = list(tables(structure))
    for i, pages in enumerate(table_pages):
        assert None not in pages and len(pages) == 1, f'{path.name} table {i + 1}: spans {pages}'
    if path.stem.isdigit():
        original_tables += len(table_pages)
    pdf = fitz.open(path)
    all_text = []
    for i, page in enumerate(pdf):
        text = page.get_text()
        all_text.append(text)
        assert len(text.strip()) > 6, f'{path.name}: blank page {i + 1}'
        assert '跳至主要內容' not in text
        for box in page.get_text('blocks'):
            assert box[0] >= -1 and box[2] <= page.rect.width + 1, (path.name, i + 1, box[:4])
            assert box[1] >= -1 and box[3] <= page.rect.height + 1, (path.name, i + 1, box[:4])
    if path.stem == 'long-answer':
        assert '長答案最後一句' in ''.join(all_text)
    if path.stem == 'long-table-answer':
        assert '表格答案最後一句' in ''.join(all_text)
        assert '第一欄最後一句' in ''.join(all_text)
    reports.append({'file': path.name, 'pages': len(pdf), 'wholeTables': len(table_pages)})
    print(json.dumps(reports[-1], ensure_ascii=False), flush=True)
assert original_tables == manifest['originalTables'], original_tables
assert len(reports) == manifest['pdfs'], len(reports)
(directory / 'layout-report.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2))
print(json.dumps({'passed': True, 'pdfs': len(reports), 'originalTablesOnSinglePages': original_tables}))
