#!/usr/bin/env python3
"""Turn captured HTTP messages into local evidence images using portable templates."""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

from capture import Capture
from presentation import build
from templates import load_template, pixel_width, validate
from traffic import load


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--request', help='Raw HTTP request file; - reads stdin')
    source.add_argument('--har', help='HAR export; - reads stdin')
    source.add_argument('--exchange', help='Exchange JSON object/array; - reads stdin')
    parser.add_argument('--response', help='Raw HTTP response file')
    parser.add_argument('--entry', type=int, help='One-based HAR entry; default: all')
    parser.add_argument('--output', type=Path, required=True, help='New output directory')
    parser.add_argument('--template', default='caido', help='caido, caido-stacked, caido-a4, report, dark, compact, or JSON template path')
    parser.add_argument('--title', default='HTTP evidence')
    parser.add_argument('--layout', choices=('horizontal', 'vertical'))
    parser.add_argument('--theme', choices=('light', 'dark'))
    parser.add_argument('--width', help='Pixel width, full, a4 (595), or letter (612)')
    parser.add_argument('--viewport-width', type=int, default=1440, help='CSS pixel width used by full-width templates')
    parser.add_argument('--font-size', type=int)
    parser.add_argument('--font-family', choices=('bundled', 'system'))
    parser.add_argument('--line-height', type=float)
    parser.add_argument('--request-ratio', type=int, help='Request panel percentage in a horizontal layout')
    parser.add_argument('--set', dest='overrides', action='append', default=[], metavar='KEY=JSON', help='Override any template setting, including dotted keys such as colors.accent')
    parser.add_argument('--css', type=Path, action='append', default=[], help='Append a trusted local stylesheet; repeatable')
    parser.add_argument('--page-lines', type=int, help='Logical lines per panel per sheet; 0 means full exchange')
    parser.add_argument('--scale', type=int, choices=(1, 2, 3), default=2)
    parser.add_argument('--browser', choices=('auto', 'agent-browser', 'playwright'), default='auto')
    parser.add_argument('--pretty', action='store_true', default=None, help='Pretty-format recognized bodies (default; can override a custom template)')
    parser.add_argument('--raw', action='store_true', help='Disable pretty formatting for this render')
    parser.add_argument('--redact', action='append', default=[])
    parser.add_argument('--redact-file', type=Path, help='JSON array of literal secret strings')
    parser.add_argument('--redact-regex', action='append', default=[])
    parser.add_argument('--highlight', action='append', default=[])
    parser.add_argument('--hide-header', action='append', default=[])
    parser.add_argument('--hide-body', action='store_true')
    parser.add_argument('--no-auto-redact', action='store_true')
    parser.add_argument('--show-timestamp', action=argparse.BooleanOptionalAction, default=None)
    parser.add_argument('--show-response-info', action=argparse.BooleanOptionalAction, default=None)
    parser.add_argument('--show-title', action=argparse.BooleanOptionalAction, default=None)
    parser.add_argument('--show-notes', action=argparse.BooleanOptionalAction, default=None)
    parser.add_argument('--timestamp', help='Supplied timestamp text to display in the metadata strip')
    parser.add_argument('--response-bytes', type=int, help='Response size supplied by the capture tool')
    parser.add_argument('--duration-ms', type=float, help='Round-trip time supplied by the capture tool')
    parser.add_argument('--url', help='Captured absolute URL, when absent from the raw request')
    parser.add_argument('--sni', help='Captured SNI value')
    parser.add_argument('--html-only', action='store_true')
    args = parser.parse_args()
    if args.response and not args.request:
        parser.error('--response requires --request')
    if args.entry is not None and (not args.har or args.entry < 1):
        parser.error('--entry requires --har and a positive index')
    if args.pretty and args.raw:
        parser.error('Choose --pretty or --raw')
    if args.request == '-' and args.response == '-':
        parser.error('Only one input can read stdin')
    if not 480 <= args.viewport_width <= 4000:
        parser.error('--viewport-width must be 480..4000')
    if args.response_bytes is not None and args.response_bytes < 0:
        parser.error('--response-bytes must be nonnegative')
    if args.duration_ms is not None and not 0 <= args.duration_ms < float('inf'):
        parser.error('--duration-ms must be finite and nonnegative')
    return args


def settings_for(args):
    settings = load_template(args.template)
    for name in ('layout', 'theme', 'font_size', 'font_family', 'line_height', 'request_ratio', 'page_lines', 'pretty', 'show_timestamp', 'show_response_info', 'show_title', 'show_notes'):
        value = getattr(args, name)
        if value is not None:
            settings[name] = value
    if args.width:
        settings['width'] = args.width.lower() if args.width.lower() in ('full', 'a4', 'letter') else int(args.width)
    if args.raw:
        settings['pretty'] = False
    if args.no_auto_redact:
        settings['auto_redact'] = False
    settings['headers_to_hide']['both'].extend(args.hide_header)
    if args.hide_body:
        settings['hide_body'] = ['request', 'response']
    if args.redact_file:
        values = json.loads(args.redact_file.read_text(encoding='utf-8'))
        if not isinstance(values, list) or any(not isinstance(value, str) or not value for value in values):
            raise ValueError('Redaction file must be a JSON array of nonempty strings')
        args.redact.extend(values)
    settings['redactions'].extend({'pattern': value} for value in args.redact)
    settings['redactions'].extend({'pattern': value, 'match': 'regex'} for value in args.redact_regex)
    settings['highlights'].extend({'pattern': value} for value in args.highlight)
    for override in args.overrides:
        key, separator, value = override.partition('=')
        if not separator or not key or any(not part for part in key.split('.')):
            raise ValueError('--set requires KEY=JSON, with a valid dotted key')
        try:
            decoded = json.loads(value)
        except json.JSONDecodeError:
            raise ValueError('--set values must be JSON; quote string values') from None
        current = settings
        parts = key.split('.')
        for part in parts[:-1]:
            if not isinstance(current.get(part), dict):
                raise ValueError('--set intermediate keys must name existing objects')
            current = current[part]
        current[parts[-1]] = decoded
    if not isinstance(settings.get('css'), str):
        raise ValueError('css must be a string')
    for path in args.css:
        settings['css'] += '\n' + path.read_text(encoding='utf-8')
    return validate(settings)


def main():
    args = arguments()
    settings = settings_for(args)
    exchanges, digests = load(args)
    for exchange in exchanges:
        for name in ('timestamp', 'response_bytes', 'duration_ms', 'url', 'sni'):
            value = getattr(args, name)
            if value is not None:
                if name == 'duration_ms' and value.is_integer():
                    value = int(value)
                exchange.metadata[name] = value
    render_settings = deepcopy(settings)
    render_settings['width'] = pixel_width(settings['width'], args.viewport_width)
    documents = [build(exchange, render_settings, args.title) for exchange in exchanges]
    # A fresh directory prevents stale unredacted artifacts from an earlier run.
    args.output.mkdir(parents=True, exist_ok=False)
    artifacts, summaries, html_files = [], [], []
    for index, (content, count, summary) in enumerate(documents, 1):
        path = args.output / f'exchange-{index:03}.html'
        path.write_text(content, encoding='utf-8')
        artifacts.append(path)
        html_files.append((path, count))
        summaries.append({'index': index, 'sheets': count, 'messages': summary})
    backend = None
    if not args.html_only:
        with Capture(args.browser, render_settings['width'], args.scale) as capture:
            backend = capture.backend
            for path, count in html_files:
                artifacts.extend(capture.capture(path, count))
    manifest = {
        'version': 2,
        'sources_sha256': digests,
        'template_sha256': hashlib.sha256(json.dumps(settings, sort_keys=True).encode()).hexdigest(),
        'presentation': {key: render_settings[key] for key in ('appearance', 'theme', 'layout', 'width', 'font_size', 'font_family', 'line_height', 'page_lines', 'auto_redact', 'pretty', 'show_timestamp', 'show_response_info', 'show_title', 'show_notes')},
        'content_width': settings['width'],
        'scale': args.scale,
        'png_dpi': args.scale * 96,
        'customization': {
            'palette_keys': sorted(settings['colors']),
            'spacing_keys': sorted(settings['spacing']),
            'css_sha256': hashlib.sha256(settings['css'].encode()).hexdigest(),
        },
        'browser': backend,
        'exchange_count': len(exchanges),
        'exchanges': summaries,
        'artifacts': [{'name': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in artifacts],
    }
    (args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    unmatched = sum(count == 0 for exchange in summaries for message in exchange['messages'].values() for count in message['rule_matches'].values())
    print(json.dumps({'output': str(args.output), 'exchanges': len(exchanges), 'images': sum(path.suffix == '.png' for path in artifacts), 'unmatched_rules_per_message': unmatched, 'manifest': str(args.output / 'manifest.json')}))


if __name__ == '__main__':
    try:
        main()
    except json.JSONDecodeError:
        print('Render failed: invalid JSON input or template.', file=sys.stderr)
        sys.exit(1)
    except FileExistsError:
        print('Render failed: output directory exists; choose a new directory.', file=sys.stderr)
        sys.exit(1)
    except (ValueError, re.error) as error:
        print(f'Render failed: {error}', file=sys.stderr)
        sys.exit(1)
    except (OSError, KeyError, IndexError, TypeError, RecursionError, subprocess.TimeoutExpired):
        print('Render failed: check input structure, file access, runtime, and browser permissions. A partial run may remain; use a new output directory.', file=sys.stderr)
        sys.exit(1)
