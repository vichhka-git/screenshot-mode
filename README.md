<div align="center">
  <img width="1000" alt="Caido" src="assets/banner.png">

  <br />
  <br />
  <a href="https://github.com/vichhka-git/screenshot-mode" target="_blank">Github</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://developer.caido.io/" target="_blank">Documentation</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://links.caido.io/www-discord" target="_blank">Discord</a>
  <br />
  <hr />
</div>

# Screenshot Mode++

Create screenshots of requests and responses inside Caido. No external tools.

<img width="1450" height="913" alt="Screenshot Mode++ overlay with a Pretty request and a rendered response preview" src="assets/screenshot.png" />

## Views

The request and response panels each have a view switch.

| Panel | Views |
| --- | --- |
| Request | Pretty, Raw |
| Response | Pretty, Raw, Preview |

Pretty formats JSON, HTML, XML, and form-encoded bodies with two-space indentation. The start line and headers stay as captured. Raw shows the message without changes. Headers you hide are removed in every view. Each Replay tab keeps its own selection.

### Preview

Preview renders the selected response the way a browser would show it. Use it for HTML pages and error documents where raw markup is hard to read.

Caido's rendering engine is required. Install it from Settings > Rendering in Caido's account menu. If the engine is missing, the panel shows what to install.

## Installation

### From a release

1. Download `plugin_package.zip` from the [latest release](https://github.com/vichhka-git/screenshot-mode/releases/latest).
2. In Caido, open Plugins and click Install Package.
3. Select the downloaded file.

This fork uses its own plugin identifier, so uninstall the official Screenshot Mode plugin to avoid duplicate toolbar buttons and shortcuts.

### From source

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Build the plugin:

   ```bash
   pnpm build
   ```

3. Install `dist/plugin_package.zip` from Caido's plugin settings.

## Usage

1. Open Replay, open a tab, and click Screenshot.
2. Pick a view for the request and response.
3. Hide headers, add highlights or redactions, then choose Save Screenshot or Copy To Clipboard.

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## License

MIT. See [LICENSE](LICENSE).

Maintained by [vichhka-git](https://github.com/vichhka-git).
