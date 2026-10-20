"""Versioned, portable presentation settings."""
from copy import deepcopy
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
DEFAULT = {
    'version': 1, 'name': 'Report', 'theme': 'light', 'layout': 'vertical',
    'width': 1200, 'font_size': 15, 'line_height': 1.6, 'page_lines': 40,
    'request_ratio': 50, 'line_numbers': True, 'syntax_colors': True,
    'pretty': True, 'auto_redact': True, 'show_metadata': True,
    'headers_to_hide': {'both': [], 'request': [], 'response': []},
    'hide_body': [], 'highlights': [], 'redactions': [],
    'line_ranges': {'request': None, 'response': None},
    'appearance': 'report', 'font_family': 'bundled',
    'show_title': True, 'show_notes': True,
    'show_timestamp': True, 'show_response_info': True, 'show_sni': True,
    'colors': {}, 'spacing': {}, 'css': '',
}

PRESETS = ('report', 'dark', 'compact', 'caido', 'caido-stacked', 'caido-a4')

COLOR_NAMES = (
    'canvas', 'paper', 'panel', 'ink', 'muted', 'border', 'syntax', 'accent',
    'method', 'protocol', 'string', 'form_value', 'url_background',
    'start_background', 'divider', 'metadata_background',
)
SPACING_NAMES = (
    'header_x', 'header_y', 'panel_x', 'panel_y', 'panel_title_x',
    'panel_title_y', 'gutter_width', 'line_gap', 'divider_width',
    'corner_radius', 'metadata_x', 'metadata_y',
)


def pixel_width(value, viewport_width=1440):
    return {'full': viewport_width, 'a4': 595, 'letter': 612}.get(value, value)


def merge(base, patch):
    result = deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = merge(result[key], value)
        else:
            result[key] = deepcopy(value)
    return result


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate_rule(rule, kind, index):
    prefix = f'{kind}[{index}]'
    require(isinstance(rule, dict), f'{prefix} must be an object')
    allowed = {'target', 'match', 'pattern', 'groups', 'mode', 'color', 'replacement'}
    require(not set(rule) - allowed, f'{prefix} has unknown fields')
    require(rule.get('target', 'both') in ('request', 'response', 'both'), f'{prefix}.target is invalid')
    require(rule.get('match', 'string') in ('string', 'regex'), f'{prefix}.match is invalid')
    pattern = rule.get('pattern')
    require(isinstance(pattern, str) and bool(pattern), f'{prefix}.pattern must be a nonempty string')
    try:
        compiled = re.compile(pattern if rule.get('match') == 'regex' else re.escape(pattern))
    except re.error:
        raise ValueError(f'{prefix}.pattern is not a valid regex') from None
    if 'color' in rule:
        require(isinstance(rule['color'], str) and bool(re.fullmatch(r'#[0-9a-fA-F]{6}', rule['color'])), f'{prefix}.color must be #RRGGBB')
    modes = ('highlight', 'rectangle') if kind == 'highlights' else ('replace', 'opaque', 'blur')
    require(rule.get('mode', modes[0]) in modes, f'{prefix}.mode is invalid')
    require(isinstance(rule.get('replacement', '[REDACTED]'), str), f'{prefix}.replacement must be a string')
    groups = rule.get('groups', [])
    require(isinstance(groups, list) and all(type(group) is int and 1 <= group <= compiled.groups for group in groups), f'{prefix}.groups must reference existing regex capture groups')


def validate(settings):
    require(isinstance(settings, dict), 'Template must be an object')
    require(not set(settings) - set(DEFAULT), 'Template has unknown fields')
    require(type(settings['version']) is int and settings['version'] == 1, 'Template version must be 1')
    require(isinstance(settings['name'], str), 'Template name must be a string')
    require(settings['theme'] in ('light', 'dark'), 'Theme must be light or dark')
    require(settings['layout'] in ('horizontal', 'vertical'), 'Layout must be horizontal or vertical')
    require(settings['appearance'] in ('report', 'caido'), 'Appearance must be report or caido')
    require(settings['font_family'] in ('bundled', 'system'), 'font_family must be bundled or system')
    colors = settings['colors']
    require(isinstance(colors, dict) and not set(colors) - set(COLOR_NAMES), 'colors contains unsupported palette names')
    require(all(isinstance(value, str) and re.fullmatch(r'#[0-9a-fA-F]{6}', value) for value in colors.values()), 'Palette colors must be #RRGGBB strings')
    spacing = settings['spacing']
    require(isinstance(spacing, dict) and not set(spacing) - set(SPACING_NAMES), 'spacing contains unsupported names')
    require(all(type(value) is int and 0 <= value <= 96 for value in spacing.values()), 'Spacing must use integer pixels from 0 to 96')
    require(isinstance(settings['css'], str) and not re.search(r'</style', settings['css'], re.I), 'css must be stylesheet text without an HTML closing style tag')
    width = settings['width']
    require((type(width) is int and 480 <= width <= 4000) or (isinstance(width, str) and width in ('full', 'a4', 'letter')), 'width must be 480..4000, full, a4, or letter')
    for key, low, high in (('font_size', 10, 24), ('page_lines', 0, 500), ('request_ratio', 20, 80)):
        require(type(settings[key]) is int and low <= settings[key] <= high, f'{key} must be an integer from {low} to {high}')
    require(type(settings['line_height']) in (int, float) and 1.2 <= settings['line_height'] <= 2.5, 'line_height must be 1.2..2.5')
    for key in ('line_numbers', 'syntax_colors', 'pretty', 'auto_redact', 'show_metadata', 'show_title', 'show_notes', 'show_timestamp', 'show_response_info', 'show_sni'):
        require(type(settings[key]) is bool, f'{key} must be boolean')
    hidden = settings['headers_to_hide']
    require(isinstance(hidden, dict) and set(hidden) == {'both', 'request', 'response'}, 'headers_to_hide requires both, request and response arrays')
    for values in hidden.values():
        require(isinstance(values, list) and all(isinstance(value, str) and value.strip('!') for value in values), 'Hidden header rules must be nonempty strings')
    require(isinstance(settings['hide_body'], list) and all(value in ('request', 'response') for value in settings['hide_body']), 'hide_body must list request and/or response')
    ranges = settings['line_ranges']
    require(isinstance(ranges, dict) and set(ranges) == {'request', 'response'}, 'line_ranges requires request and response')
    for value in ranges.values():
        require(value is None or (isinstance(value, list) and len(value) == 2 and all(type(item) is int for item in value) and 1 <= value[0] <= value[1]), 'Line ranges must be null or [first, last] with positive line numbers')
    for kind in ('highlights', 'redactions'):
        require(isinstance(settings[kind], list), f'{kind} must be an array')
        for index, rule in enumerate(settings[kind]):
            validate_rule(rule, kind, index)
    return settings


def load_template(value, chain=()):
    path = Path(value).expanduser()
    if value in PRESETS:
        path = ROOT / 'templates' / f'{value}.json'
    path = path.resolve()
    require(path not in chain, 'Template inheritance contains a cycle')
    require(len(chain) < 16, 'Template inheritance exceeds 16 files')
    data = json.loads(path.read_text(encoding='utf-8'))
    require(isinstance(data, dict), 'Template must be an object')
    parent = data.pop('extends', None)
    require(parent is None or (isinstance(parent, str) and bool(parent)), 'extends must name a preset or local template file')
    if parent is None:
        base = DEFAULT
    else:
        parent_path = parent if parent in PRESETS else str(path.parent / Path(parent).expanduser())
        base = load_template(parent_path, chain + (path,))
    return validate(merge(base, data))
