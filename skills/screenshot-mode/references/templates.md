# Template contract (version 1)

Use `--template caido` (the CLI default), `caido-stacked`, `caido-a4`, `report`, `dark`, `compact`, or a JSON template path. A custom file may `"extends": "caido"` or inherit another local JSON template. Local parent paths resolve relative to the child file. Cycles and inheritance chains exceeding 16 files are rejected. Nested objects merge; arrays replace inherited arrays. CLI overrides apply last. Unknown fields and invalid rules fail before output creation.

Rule files can contain sensitive literals: keep them private and share the generated artifacts after review. The renderer does not copy templates into its output. See [customization](customization.md#reusable-template) for a template example.

| Setting | Meaning |
| --- | --- |
| `version` | `1` |
| `name` | Local template name; not embedded in evidence |
| `theme` | `light` or `dark` |
| `layout` | `horizontal` or `vertical` |
| `appearance` | `caido` for the reference traffic display; `report` for the titled report surface |
| `width` | 480..4000 CSS pixels, `full`, `a4` (595), or `letter` (612); full uses `--viewport-width` |
| `request_ratio` | 20..80 percent of horizontal panel space; default 50 |
| `font_size` | 10..24 CSS pixels; default 15 |
| `line_height` | 1.2..2.5; default 1.6 |
| `font_family` | `bundled` (default, embedded JetBrains Mono) or `system` |
| `page_lines` | 0..500 logical lines per panel per sheet; 0 means one full exchange image |
| `line_numbers`, `syntax_colors` | Boolean display switches |
| `pretty` | Boolean, default true; `--raw` disables body formatting |
| `auto_redact` | Boolean, default true |
| `show_metadata` | Master switch for supplied SNI, timestamp, duration and size |
| `show_timestamp` | Independently show the supplied timestamp at the left of the metadata strip |
| `show_response_info` | Independently show supplied size and round-trip time at the right |
| `show_sni` | Show supplied SNI next to the URL |
| `show_title` | Show a report title; false in Caido presets |
| `show_notes` | Show formatting labels and the explanatory footer; false in Caido presets |
| `headers_to_hide` | Object with `both`, `request`, `response` arrays |
| `hide_body` | Array containing `request` and/or `response` |
| `line_ranges` | Object with `request` and `response`: null or inclusive `[first, last]` display lines |
| `highlights`, `redactions` | Rule arrays |
| `colors` | Overrides for named palette colors; six-digit hex strings |
| `spacing` | Named spacing overrides in integer CSS pixels, 0..96 |
| `css` | Optional trusted stylesheet text applied after the generated palette/spacing |

See [customization](customization.md) for the color/spacing keys, CSS selectors, `--set`, and examples. Custom template files can live outside the installed skill folder.

## Rules

Each rule has `pattern` (required), `target` (`both` by default), and `match` (`string` by default; `regex` uses Python syntax). Optional `groups` selects positive capture-group numbers instead of the whole match. Unmatched optional groups are skipped. Empty patterns are rejected. Regexes operate over the entire visible message, so inline flags such as `(?m)` enable line anchors when needed.

Highlight modes are `highlight` and `rectangle`; `color` is a six-digit hex color. Highlighting runs after redaction and skips overlaps with replacement text. Syntax colors have lower priority than annotations.

Redaction modes are `replace` (default), `opaque`, and `blur`. Every mode removes original matched text before HTML generation. `replacement` defaults to `[REDACTED]`; a safe custom label can be supplied. Opaque uses `color`, default `#111827`, as a background for the replacement. Blur blurs the replacement. The original secret is never the visual effect's backing text.

Overlapping redaction ranges are merged. The earliest starting range supplies the replacement and style; for the same start, the longest range wins. Redactions are not recursive. Automatic credential-header rules participate in the same merge. Custom rules are also applied to the title, endpoint, and supplied metadata irrespective of their message target, so duplicated values receive the same treatment.

Hidden header names match case insensitively. `!Content-Length` always shows that header even if another rule hides it; an always-show exception does not disable redaction. All duplicates and folded continuations follow their header's hide decision. No headers are hidden by the report or dark preset; compact opts into a short noise-header list.

## Transformation order and reporting

Normalize CRLF and escape display control characters; hide selected headers/bodies; optionally format; replace redacted spans; highlight the remaining text; select optional line ranges; paginate. Write templates to match the formatted view when `pretty` is enabled. Formatting preserves JSON lexical tokens rather than parsing numbers into floating point values.

The manifest records per-message formatting actually used, hidden header counts, redacted range counts, selected line ranges, and match counts by rule index. A rule with zero matches is visible in the manifest and the CLI's unmatched-rule count. Neither the rule patterns nor replacement values are written to the manifest.

## Rendering assets

`assets/document.html` is the trusted document shell; `assets/report.css` controls appearance. Traffic is always escaped before insertion. Modify these assets to introduce another report style. Template JSON controls supported settings; it is not arbitrary executable HTML or CSS. The local code font is embedded as a data URI, permitted by the font CSP, and loaded before capture. External page resources remain blocked.

The Caido appearance uses neutral dark panels, narrow gutters, yellow header names/JSON keys, purple methods, green protocol versions and string values, and a compact black metadata strip. Its syntax palette identifies traffic structure. Arbitrary selected evidence uses explicit highlight rules. Panels keep the chosen orientation at every export width; the general report appearance can reflow for narrow HTML views. Numbered sheets preserve context. No animation is included.
