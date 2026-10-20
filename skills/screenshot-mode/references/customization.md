# Custom rendering and reusable templates

Start from `caido` when no other style is specified. Translate report-specific presentation requirements into CLI options or a template. Agent-created templates are ordinary JSON files that can live beside the report files and be reused with any tool's captured traffic.

Pretty formatting is on by default. `--raw` disables it for one render, while `"pretty": false` records that choice in a template. `--pretty` explicitly enables it when overriding such a template.

## One render

Named flags cover common settings:

```bash
python3 scripts/render.py --request request.txt --response response.txt \
  --layout vertical --width a4 --font-size 15 --line-height 1.5 \
  --set 'show_timestamp=false' \
  --set 'colors.accent="#A87900"' \
  --set 'spacing.gutter_width=38' \
  --output output/render-001
```

`--set KEY=JSON` supports the full template contract. Dotted keys select object fields; array values replace the whole array, rather than indexing individual elements. Values must be JSON, so strings include double quotes inside the shell's single quotes.

## Reusable template

```json
{
  "extends": "caido",
  "name": "Client report",
  "layout": "vertical",
  "width": "a4",
  "pretty": true,
  "colors": {"accent": "#E8BD56"},
  "spacing": {"header_x": 18, "line_gap": 14},
  "highlights": [{"target": "response", "pattern": "account_id"}]
}
```

Use `--template path/to/client-report.json`. Another template may inherit it with `"extends": "./client-report.json"`; the parent path is relative to that child file, independent of the current working directory. Preset names always refer to the bundled presets. Absolute local paths are also supported. No template is fetched from a URL.

Nested objects merge, so overriding one color retains the parent's other color overrides. Arrays replace inherited arrays. Scalar values, including `css`, replace the parent's value when supplied by the child.

Precedence is: defaults, inherited templates, selected template, named CLI options, ordered `--set` overrides, then appended `--css` files. Visual CSS has the normal CSS cascade; structured settings generate their styles before the template's `css` and the appended stylesheets.

## Palette

The `colors` object accepts six-digit `#RRGGBB` values for:

| Key | Role |
| --- | --- |
| `canvas` | Background outside the sheets in the HTML view |
| `paper` | Sheet and panel-heading background |
| `panel` | Traffic body background |
| `ink` | Main text |
| `muted` | Secondary text and gutters |
| `border` | Surface borders |
| `syntax` | General syntax/endpoint accent in the report appearance |
| `accent` | Header names and JSON keys |
| `method` | Request method |
| `protocol` | HTTP version and form keys |
| `string` | JSON strings, status and numbers |
| `form_value` | Form values |
| `url_background` | URL/SNI field background in the Caido appearance |
| `start_background` | Start-line background in the Caido appearance |
| `divider` | Separator between Caido traffic panels |
| `metadata_background` | Caido metadata strip |

Choose colors with readable text/background contrast. Set `"theme": "light"` when starting a light document palette.

## Spacing

The `spacing` object accepts integer CSS pixels from 0 to 96:

| Key | Role |
| --- | --- |
| `header_x`, `header_y` | URL/title strip padding |
| `panel_x`, `panel_y` | Traffic container padding |
| `panel_title_x`, `panel_title_y` | Request/Response heading padding |
| `gutter_width` | Line-number column width |
| `line_gap` | Gap between gutter and traffic text |
| `divider_width` | Panel separator thickness |
| `corner_radius` | Sheet and panel corner radius |
| `metadata_x`, `metadata_y` | Metadata/footer padding |

The existing `font_size`, `line_height`, `request_ratio`, `width`, `page_lines`, and display switches remain available for typography and structure. PNG capture excludes the surrounding HTML canvas, so `colors.canvas` affects the HTML preview rather than adding an image border.

## Custom CSS

Use `--css path/to/style.css`, repeated in cascade order, or put stylesheet text in `css` inside a template. Stylesheets are read locally and embedded into each HTML artifact. The default network restrictions remain in place, including blocked remote imports, images and fonts. The bundled font uses an embedded data URI.

Useful selectors are:

| Selector | Element |
| --- | --- |
| `body[data-appearance]` | Root appearance and theme variables |
| `.sheet` | One complete screenshot surface |
| `header`, `.endpoints`, `.endpoint` | Title and URL/SNI strip |
| `.panels`, `.panel.request`, `.panel.response` | Traffic layout and panels |
| `h2`, `.lines`, `.line`, `.number`, `.line code` | Pane headings, rows and gutters |
| `.syntax-method`, `.syntax-header`, `.syntax-string` | Syntax spans |
| `.metadata`, `.timestamp`, `.response-info` | Metadata strip |
| `.omission`, `.empty` | Explicit omission and continuation labels |

The browser captures the `.sheet` elements, whose IDs follow `page-001`. Preserve those elements and readable content when restyling. To match or exceed the built-in selector specificity, scope overrides through `body[data-appearance]`:

```css
body[data-appearance] .sheet {
  border-top: 4px solid var(--protocol);
}
```

Traffic transformation, redaction, escaping, and line selection occur before HTML rendering. Use those features to remove or omit text; CSS blur, overlays and `display:none` preserve underlying HTML content. Keep presentation files free of captured traffic and secrets. CSS text containing a closing HTML style tag is rejected.

The manifest records selected palette/spacing key names and a custom-CSS hash. It does not copy stylesheet paths, CSS text or rule values into the manifest. The HTML embeds the resulting styles for offline use.
