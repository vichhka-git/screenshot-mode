"""Local browser backends for capturing already sanitized sheets."""
import importlib.util
import json
import shutil
import subprocess
import struct
import uuid
import zlib


def set_png_density(path, dpi):
    raw = path.read_bytes()
    density = struct.pack('>IIB', round(dpi / 0.0254), round(dpi / 0.0254), 1)
    chunk = b'pHYs' + density
    chunk = struct.pack('>I', len(density)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)
    output, offset = [raw[:8]], 8
    while offset < len(raw):
        size = struct.unpack('>I', raw[offset:offset + 4])[0]
        kind = raw[offset + 4:offset + 8]
        if kind != b'pHYs':
            output.append(raw[offset:offset + size + 12])
        if kind == b'IHDR':
            output.append(chunk)
        offset += size + 12
    path.write_bytes(b''.join(output))


class Capture:
    def __init__(self, backend, width, scale):
        self.width, self.scale = width, scale
        if backend == 'auto':
            backend = 'agent-browser' if shutil.which('agent-browser') else 'playwright'
        self.backend = backend
        self.session = 'screenshot-mode-' + uuid.uuid4().hex[:12]
        self.browser = None
        self.playwright = None
        self.started = False

    def command(self, *arguments):
        result = subprocess.run(
            ['agent-browser', '--session', self.session, '--json', *map(str, arguments)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode:
            raise ValueError('agent-browser failed; check its runtime and browser permissions')
        try:
            value = json.loads(result.stdout)
            if isinstance(value, dict) and value.get('success') is False:
                raise ValueError('agent-browser operation failed')
        except json.JSONDecodeError:
            raise ValueError('agent-browser returned an unexpected result') from None
        return value

    def __enter__(self):
        if self.backend == 'agent-browser':
            if not shutil.which('agent-browser'):
                raise ValueError('agent-browser is not installed; select --browser playwright or --html-only')
            try:
                self.command('open', 'about:blank')
                self.started = True
                self.command('set', 'offline', 'on')
                self.command('set', 'viewport', self.width * self.scale, 900, 1)
            except Exception:
                self.__exit__(None, None, None)
                raise
        else:
            if importlib.util.find_spec('playwright') is None:
                raise ValueError('PNG needs agent-browser or Playwright with Chromium; use --html-only to export without a browser')
            from playwright.sync_api import sync_playwright
            self.playwright = sync_playwright().start()
            try:
                self.browser = self.playwright.chromium.launch()
                self.page = self.browser.new_page(viewport={'width': self.width + 48, 'height': 900}, device_scale_factor=self.scale, offline=True)
                self.page.route('**/*', lambda route: route.abort() if not route.request.url.startswith('file:') else route.continue_())
            except Exception:
                self.__exit__(None, None, None)
                raise ValueError('Chromium could not start; install its runtime and check browser permissions') from None
        return self

    def capture(self, path, count):
        outputs = []
        if self.backend == 'agent-browser':
            self.command('open', path.resolve().as_uri())
            self.command('eval', 'document.fonts.ready.then(() => true)')
        else:
            self.page.goto(path.resolve().as_uri(), wait_until='load')
            self.page.evaluate('document.fonts.ready.then(() => true)')
        for index in range(1, count + 1):
            output = path.with_name(f'{path.stem}-{index:03}.png').resolve()
            selector = f'#page-{index:03}'
            if self.backend == 'agent-browser':
                # Rasterize at CSS zoom with DPR=1 to avoid CDP clip/compositor scaling artifacts.
                measurement = self.command('eval', '''(() => {
                    document.documentElement.style.zoom = %s;
                    document.body.style.padding = '0';
                    document.querySelector('main').style.margin = '0';
                    for (const sheet of document.querySelectorAll('.sheet')) {
                        sheet.style.display = sheet.id === %s ? 'block' : 'none';
                        sheet.style.margin = '0';
                    }
                    return Math.ceil(document.querySelector(%s).getBoundingClientRect().height);
                })()''' % (self.scale, json.dumps(selector[1:]), json.dumps(selector)))
                height = int(measurement['data']['result'])
                if height > 16000:
                    raise ValueError('Sheet is too tall to capture reliably; reduce page_lines or split long lines in a separately labeled representation')
                self.command('set', 'viewport', self.width * self.scale, max(1, height), 1)
                self.command('eval', 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))')
                self.command('screenshot', '--full', output)
            else:
                self.page.locator(selector).screenshot(path=str(output))
            if not output.exists() or output.read_bytes()[:8] != b'\x89PNG\r\n\x1a\n':
                raise ValueError('Browser did not produce a valid PNG artifact')
            set_png_density(output, self.scale * 96)
            outputs.append(output)
        return outputs

    def __exit__(self, *_):
        if self.backend == 'agent-browser' and self.started:
            try:
                self.command('close')
            except (ValueError, OSError, subprocess.TimeoutExpired):
                pass
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()
