"""Build complete screenshot sheets from sanitized messages."""
from pathlib import Path
import base64
import html
import math
import re
from string import Template

from evidence import prepare, redact, rows

ASSETS = Path(__file__).resolve().parent.parent / 'assets'


def custom_styles(settings):
    rules = []
    if settings['colors']:
        variables = ';'.join('--' + name.replace('_', '-') + ':' + value for name, value in settings['colors'].items())
        rules.append('body[data-appearance][data-theme] {' + variables + '}')
    selectors = {
        'header_x': ('header', 'padding-left:{0}px;padding-right:{0}px'),
        'header_y': ('header', 'padding-top:{0}px;padding-bottom:{0}px'),
        'panel_x': ('.lines', 'padding-left:{0}px;padding-right:{0}px'),
        'panel_y': ('.lines', 'padding-top:{0}px;padding-bottom:{0}px'),
        'panel_title_x': ('h2', 'padding-left:{0}px;padding-right:{0}px'),
        'panel_title_y': ('h2', 'padding-top:{0}px;padding-bottom:{0}px'),
        'gutter_width': ('.number', 'flex-basis:{0}px'),
        'line_gap': ('.line', 'gap:{0}px'),
        'corner_radius': ('.sheet, body[data-appearance] .panel', 'border-radius:{0}px'),
        'metadata_x': ('footer', 'padding-left:{0}px;padding-right:{0}px'),
        'metadata_y': ('footer', 'padding-top:{0}px;padding-bottom:{0}px'),
    }
    for name, value in settings['spacing'].items():
        if name == 'divider_width':
            rules.extend((
                f'body[data-appearance][data-layout="vertical"] .panel + .panel {{border-top-width:{value}px;}}',
                f'body[data-appearance][data-layout="horizontal"] .panel + .panel {{border-left-width:{value}px;}}',
            ))
        else:
            selector, declarations = selectors[name]
            rules.append('body[data-appearance] ' + selector + ' {' + declarations.format(value) + '}')
    rules.append(settings['css'])
    return '\n'.join(rules)


def escape(value, settings):
    return html.escape(redact(str(value), settings)[0])


def endpoint(exchange):
    if exchange.metadata.get('url'):
        return exchange.metadata['url']
    if not exchange.request:
        return 'Endpoint not supplied'
    head = exchange.request.replace('\r\n', '\n').partition('\n\n')[0]
    parts = head.split('\n', 1)[0].split(' ')
    if len(parts) < 2:
        return 'Endpoint not supplied'
    target = parts[1]
    if re.match(r'^https?://', target):
        return target
    host = re.search(r'^Host:\s*(.+)$', head, re.I | re.M)
    return f'{host.group(1).strip()}{target} (scheme not captured)' if host else target


def build(exchange, settings, title):
    messages = {target: prepare(getattr(exchange, target), settings, target) for target in ('request', 'response') if getattr(exchange, target) is not None}
    rendered, summaries = {}, {}
    for target, message in messages.items():
        lines = rows(message, settings)
        interval = settings['line_ranges'][target]
        if interval:
            first, last = interval
            if first > len(lines):
                raise ValueError(f'{target} line range starts beyond the displayed message')
            last = min(last, len(lines))
            selected = lines[first - 1:last]
            if first > 1:
                selected.insert(0, f'<div class="omission">[Display lines 1–{first - 1} omitted]</div>')
            if last < len(lines):
                selected.append(f'<div class="omission">[Display lines {last + 1}–{len(lines)} omitted]</div>')
            lines = selected
        rendered[target] = lines
        summaries[target] = {
            'display_lines': len(message.text.split('\n')),
            'hidden_header_lines': message.hidden_headers,
            'body_hidden': message.body_hidden,
            'formatted': message.formatted,
            'redacted_ranges': len(message.redactions),
            'rule_matches': message.rule_counts,
            'line_range': interval,
        }
    page_lines = settings['page_lines'] or max(len(value) for value in rendered.values())
    count = max(math.ceil(len(value) / page_lines) for value in rendered.values())
    timestamp, response_info = '', []
    if settings['show_metadata']:
        if settings['show_timestamp'] and 'timestamp' in exchange.metadata:
            timestamp = escape(exchange.metadata['timestamp'], settings)
        if settings['show_response_info']:
            if 'response_bytes' in exchange.metadata:
                value = exchange.metadata['response_bytes']
                formatted = f'{value:,}' if type(value) is int else str(value)
                response_info.append(escape(formatted, settings) + ' bytes')
            if 'duration_ms' in exchange.metadata:
                response_info.append(escape(exchange.metadata['duration_ms'], settings) + 'ms')
    footer_parts = []
    if timestamp or response_info:
        footer_parts.append(f'<div class="metadata"><span class="timestamp">{timestamp}</span><span class="response-info">{" | ".join(response_info)}</span></div>')
    if settings['show_notes']:
        footer_parts.append('<p class="notes">Screenshot Mode · Exported HTTP text · Redactions and omissions are marked · Display line numbers</p>')
    footer = f'<footer>{"".join(footer_parts)}</footer>' if footer_parts else ''
    sheets = []
    for page in range(count):
        panels = []
        for target in ('request', 'response'):
            if target not in rendered:
                continue
            chunk = rendered[target][page * page_lines:(page + 1) * page_lines]
            contents = ''.join(chunk) or '<p class="empty">[No further lines on this sheet]</p>'
            view = f'<span>{escape(summaries[target]["formatted"], settings)}</span>' if settings['show_notes'] else ''
            panels.append(f'<section class="panel {target}"><h2>{target.title()}{view}</h2><div class="lines">{contents}</div></section>')
        heading = f'<h1>{escape(title, settings)}</h1>' if settings['show_title'] else ''
        page_number = f'<span class="page-number">{page + 1} / {count}</span>' if count > 1 or settings['show_title'] else ''
        heading = f'<div class="heading">{heading}{page_number}</div>' if heading else page_number
        sni = ''
        if settings['show_metadata'] and settings['show_sni'] and exchange.metadata.get('sni'):
            sni = f'<div class="endpoint sni"><span>SNI</span><code>{escape(exchange.metadata["sni"], settings)}</code></div>'
        sheets.append(f'''<article class="sheet" id="page-{page + 1:03}">
<header>{heading}<div class="endpoints"><div class="endpoint"><span>URL</span><code>{escape(endpoint(exchange), settings)}</code></div>{sni}</div></header>
<div class="panels {'single' if len(panels) == 1 else ''}">{''.join(panels)}</div>
{footer}</article>''')
    font_css = ''
    if settings['font_family'] == 'bundled':
        encoded = base64.b64encode((ASSETS / 'fonts' / 'JetBrainsMono-Regular.woff2').read_bytes()).decode('ascii')
        font_css = '@font-face { font-family: "Screenshot Mono"; font-style: normal; font-weight: 400; font-display: block; src: url(data:font/woff2;base64,' + encoded + ') format("woff2"); }'
    document = Template((ASSETS / 'document.html').read_text(encoding='utf-8')).substitute(
        title=escape(title, settings), theme=settings['theme'], layout=settings['layout'],
        appearance=settings['appearance'], font_family=settings['font_family'],
        custom_css=custom_styles(settings),
        css=font_css + '\n' + (ASSETS / 'report.css').read_text(encoding='utf-8'),
        width=settings['width'], font_size=settings['font_size'], line_height=settings['line_height'],
        request_ratio=settings['request_ratio'], response_ratio=100 - settings['request_ratio'], sheets='\n'.join(sheets),
    )
    return document, count, summaries
