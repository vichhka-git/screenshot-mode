<div align="center">
  <img width="1000" alt="Screenshot Mode" src="assets/banner.png">

  <br />
  <br />
  <a href="https://github.com/caido-community" target="_blank">Github</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://developer.caido.io/" target="_blank">Documentation</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://links.caido.io/www-discord" target="_blank">Discord</a>
  <br />
  <hr />
</div>

# Screenshot Mode

Create pretty screenshots of your requests and responses right inside Caido. No external tools, no pain. Start sharing!

<img width="1450" height="913" alt="Screenshot Mode overlay with a Pretty request and a rendered response preview" src="assets/screenshot.png" />

## Views

Each panel can switch views without leaving the overlay.

| View | Request | Response | What it shows |
| --- | :---: | :---: | --- |
| **Pretty** | ✅ | ✅ | Bodies formatted for reading. JSON, HTML, XML, and `application/x-www-form-urlencoded` bodies get consistent two-space indentation; the start line and headers stay exactly as captured. |
| **Raw** | ✅ | ✅ | The message exactly as captured, with no reformatting. Headers you chose to hide stay hidden. |
| **Preview** | — | ✅ | The response rendered by Caido's browser engine and shown as an image. |

### Preview

Preview renders the selected response the way a browser would, which is handy for HTML reports, error pages, and any body where raw markup is hard to read.

Caido's rendering engine is required. Install it from Caido's account menu under **Settings → Rendering** if it is not already installed. When the engine is missing, the panel explains what to install instead of showing a blank frame.

## Installation

### From a release

1. Download `plugin_package.zip` from the [latest release](https://github.com/vichhka-git/screenshot-mode/releases/latest).
2. In Caido, open **Plugins** and click **Install Package**.
3. Select the downloaded `plugin_package.zip`.

### From source

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Build the plugin:

   ```bash
   pnpm build
   ```

3. Install in Caido:
   - Upload the `dist/plugin_package.zip` file by clicking "Install Package" in Caido's plugin settings

## Usage

1. Navigate to `Replay`, open a tab, and click `Screenshot`.
2. Pick **Pretty**, **Raw**, or **Preview** for the request and response.
3. Hide headers, add highlights and redactions, then **Save Screenshot** or **Copy To Clipboard**.

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## License

MIT — see [LICENSE](LICENSE).
