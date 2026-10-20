"""Evidence transformations; redacted source text never reaches the document."""
from dataclasses import dataclass, field
import html
import json
import re

TOKEN = re.compile(r'"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]')
AUTO = re.compile(r'^(authorization|proxy-authorization|cookie|set-cookie|x-api-key):([^\n]*(?:\n[ \t][^\n]*)*)', re.I | re.M)


def reject_constant(_):
    raise ValueError('Nonstandard JSON number')


@dataclass
class Span:
    start: int
    end: int
    mode: str
    color: str = '#e2ae35'
    replacement: str = '[REDACTED]'


@dataclass
class Message:
    text: str
    redactions: list = field(default_factory=list)
    highlights: list = field(default_factory=list)
    hidden_headers: int = 0
    body_hidden: bool = False
    formatted: str = 'raw'
    rule_counts: dict = field(default_factory=dict)
    content_type: str = ''


def pretty_body(body):
    stripped = body.strip()
    if stripped.startswith(('{', '[')):
        try:
            # Validate grammar while retaining the original string and number tokens.
            json.loads(stripped, parse_int=str, parse_float=str, parse_constant=reject_constant)
            tokens = [match.group() for match in TOKEN.finditer(stripped)]
            output, depth = [], 0
            for index, token in enumerate(tokens):
                following = tokens[index + 1] if index + 1 < len(tokens) else ''
                previous = tokens[index - 1] if index else ''
                if token in ('{', '['):
                    output.append(token)
                    depth += 1
                    if following not in ('}', ']'):
                        output.append('\n' + '  ' * depth)
                elif token in ('}', ']'):
                    depth -= 1
                    if previous not in ('{', '['):
                        output.append('\n' + '  ' * depth)
                    output.append(token)
                elif token == ',':
                    output.append(',\n' + '  ' * depth)
                elif token == ':':
                    output.append(': ')
                else:
                    output.append(token)
            return ''.join(output), 'JSON whitespace'
        except (ValueError, RecursionError):
            return body, 'raw'
    if '&' in body and not re.search(r'\s', body):
        pairs = body.split('&')
        if all('=' in pair and not pair.startswith('=') for pair in pairs):
            return '\n&'.join(pairs), 'form whitespace'
    return body, 'raw'


def matches(text, rule):
    pattern = rule['pattern'] if rule.get('match') == 'regex' else re.escape(rule['pattern'])
    for match in re.finditer(pattern, text):
        for group in rule.get('groups') or [0]:
            start, end = match.span(group)
            if start >= 0 and end > start:
                yield start, end


def applies(rule, target):
    return target is None or rule.get('target', 'both') in ('both', target)


def redact(text, settings, target=None):
    spans, counts = [], {}
    if settings['auto_redact']:
        for match in AUTO.finditer(text):
            start, end = match.span(2)
            if end > start:
                spans.append(Span(start, end, 'replace', replacement=' [REDACTED]'))
    for index, rule in enumerate(settings['redactions']):
        if not applies(rule, target):
            continue
        found = list(matches(text, rule))
        counts[f'redactions.{index}'] = len(found)
        for start, end in found:
            spans.append(Span(start, end, rule.get('mode', 'replace'), rule.get('color', '#111827'), rule.get('replacement', '[REDACTED]')))
    merged = []
    for span in sorted(spans, key=lambda value: (value.start, -value.end)):
        if merged and span.start < merged[-1].end:
            merged[-1].end = max(merged[-1].end, span.end)
        else:
            merged.append(span)
    result, visible, cursor, length = [], [], 0, 0
    for span in merged:
        plain = text[cursor:span.start]
        result.extend((plain, span.replacement))
        length += len(plain)
        visible.append(Span(length, length + len(span.replacement), span.mode, span.color))
        length += len(span.replacement)
        cursor = span.end
    result.append(text[cursor:])
    return ''.join(result), visible, counts


def prepare(raw, settings, target):
    # Display control bytes as escapes so terminal controls cannot hide evidence.
    raw = raw.replace('\r\n', '\n')
    raw = ''.join(character if character in '\n\t' or (ord(character) >= 32 and not 0x7f <= ord(character) <= 0x9f and not 0x202a <= ord(character) <= 0x202e and not 0x2066 <= ord(character) <= 0x2069) else f'\\u{ord(character):04x}' for character in raw)
    head, separator, body = raw.partition('\n\n')
    content_type = next((line.partition(':')[2].strip().lower() for line in head.split('\n') if line.lower().startswith('content-type:')), '')
    rules = settings['headers_to_hide']['both'] + settings['headers_to_hide'][target]
    show = {rule[1:].lower() for rule in rules if rule.startswith('!')}
    hide = {rule.lower() for rule in rules if not rule.startswith('!')} - show
    kept, removed, omit = [], 0, False
    for index, line in enumerate(head.split('\n')):
        if index == 0:
            omit = False
        elif not line.startswith((' ', '\t')):
            omit = line.partition(':')[0].lower() in hide
        if omit:
            removed += 1
        else:
            kept.append(line)
    if removed:
        kept.append(f'[{removed} header lines hidden]')
    formatted = 'raw'
    hidden_body = bool(separator and target in settings['hide_body'])
    if hidden_body:
        body = '[Body hidden]'
    elif separator and settings['pretty']:
        if 'json' in content_type or body.lstrip().startswith(('{', '[')):
            body, formatted = pretty_body(body)
        elif 'application/x-www-form-urlencoded' in content_type:
            body, formatted = pretty_body(body)
    text = '\n'.join(kept) + ('\n\n' + body if separator else '')
    text, redactions, counts = redact(text, settings, target)
    highlights = []
    for index, rule in enumerate(settings['highlights']):
        if not applies(rule, target):
            continue
        found = [(start, end) for start, end in matches(text, rule) if not any(start < span.end and span.start < end for span in redactions)]
        counts[f'highlights.{index}'] = len(found)
        highlights.extend(Span(start, end, rule.get('mode', 'highlight'), rule.get('color', '#e2ae35')) for start, end in found)
    return Message(text, redactions, highlights, removed, hidden_body, formatted, counts, content_type)


def syntax_spans(line, index, in_headers, content_type=''):
    if index == 0:
        spans = [Span(match.start(), match.end(), 'protocol') for match in re.finditer(r'HTTP/[\d.?]+', line)]
        method = re.match(r'^[A-Z]+(?=\s)', line)
        if method:
            spans.append(Span(method.start(), method.end(), 'method'))
        status = re.match(r'^HTTP/\S+\s+(\d{3})', line)
        if status:
            spans.append(Span(*status.span(1), 'status'))
        return spans
    if in_headers and ':' in line and not line.startswith((' ', '\t')):
        return [Span(0, line.index(':') + 1, 'header')]
    if not in_headers:
        if 'application/x-www-form-urlencoded' in content_type:
            spans = []
            for match in re.finditer(r'(?:^|&)([^=&\s]+)=([^&]*)', line):
                spans.extend((Span(*match.span(1), 'form-key'), Span(*match.span(2), 'form-value')))
            return spans
        if 'json' in content_type or line.lstrip().startswith(('{', '[', '"')):
            spans = []
            for match in TOKEN.finditer(line):
                value = match.group()
                if value in '{}[],:':
                    continue
                kind = 'number'
                if value.startswith('"'):
                    kind = 'key' if line[match.end():].lstrip().startswith(':') else 'string'
                spans.append(Span(match.start(), match.end(), kind))
            return spans
    return []


def rows(message, settings):
    rendered, offset, in_headers = [], 0, True
    head = message.text.partition('\n\n')[0]
    content_type = message.content_type or next((line.partition(':')[2].strip().lower() for line in head.split('\n') if line.lower().startswith('content-type:')), '')
    for index, line in enumerate(message.text.split('\n')):
        if not line:
            in_headers = False
        syntax = syntax_spans(line, index, in_headers, content_type) if settings['syntax_colors'] else []
        decorations = []
        for kind, spans in (('redact', message.redactions), ('highlight', message.highlights)):
            for span in spans:
                start, end = max(0, span.start - offset), min(len(line), span.end - offset)
                if end > start:
                    decorations.append((kind, Span(start, end, span.mode, span.color)))
        boundaries = {0, len(line)}
        for span in syntax + [span for _, span in decorations]:
            boundaries.update((span.start, span.end))
        boundaries = sorted(boundaries)
        parts = []
        for start, end in zip(boundaries, boundaries[1:]):
            value = html.escape(line[start:end])
            token = next((span.mode for span in syntax if span.start <= start < span.end), None)
            if token:
                value = f'<span class="syntax-{token}">{value}</span>'
            for kind, span in reversed(decorations):
                if span.start <= start < span.end:
                    value = f'<span class="{kind}-{span.mode}" style="--rule-color:{span.color}">{value}</span>'
            parts.append(value)
        number = f'<span class="number" aria-hidden="true">{index + 1}</span>' if settings['line_numbers'] else ''
        rendered.append(f'<div class="line{" start-line" if index == 0 else ""}">{number}<code>{"".join(parts) or " "}</code></div>')
        offset += len(line) + 1
    return rendered
