# Runtime setup and report sizing

Resolve paths from the installed `SKILL.md` location. The skill may be installed outside the current project or in a read-only directory. Keep dependencies in a user cache and rendered output in the user's report workspace.

## Select an existing runtime

Use Python 3.9 or newer. Try `python3 --version`, `python --version`, or `py -3 --version` as appropriate for the platform. Locate a suitable existing interpreter before installing another one. If none exists, use an available package manager when the environment permits it; if installation is unavailable, report that specific blocker.

PNG capture supports:

- `agent-browser`: reuse an installed CLI. If its browser is missing, run `agent-browser install` once. The renderer uses a separate session and closes it after capture.
- Python Playwright: reuse an interpreter that imports `playwright.sync_api` and has its Chromium runtime installed. If Chromium is missing, run that interpreter's `-m playwright install chromium`.

`--browser auto` prefers agent-browser when it is on PATH. Use `--browser playwright` explicitly when selecting a Playwright environment, particularly if an installed agent-browser is broken. A package being installed does not prove its browser can launch; use the actual render's error to decide what needs repair.

## Install a missing Playwright runtime

Do this yourself as part of rendering, within the environment's dependency-installation permissions. These are agent instructions, not steps to hand back to the user. Reuse a working installation; do not recreate the environment or reinstall requirements on every task.

On macOS or Linux, set `SKILL_DIR` to the absolute directory containing this skill's `SKILL.md`, then use a writable cache:

```bash
SCREENSHOT_MODE_CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/screenshot-mode"
python3 -m venv "$SCREENSHOT_MODE_CACHE/venv"
"$SCREENSHOT_MODE_CACHE/venv/bin/python" -m pip install -r "$SKILL_DIR/requirements.txt"
"$SCREENSHOT_MODE_CACHE/venv/bin/python" -m playwright install chromium
```

Use the selected Python executable instead of `python3` if it has a different name. Create the virtual environment only if absent. If it already contains a usable Playwright installation, skip pip installation. The browser installer reuses its browser cache. Avoid global pip installs or `--break-system-packages`.

On Windows, use a user cache such as `%LOCALAPPDATA%\screenshot-mode\venv`. Create it with the selected interpreter's `-m venv`; its interpreter is `Scripts\python.exe` instead of `bin/python`. Invoke that executable with PowerShell's `&` when the path is quoted. The pip and Playwright module arguments are the same.

Linux may require system libraries for Chromium. When browser launch reports missing libraries, use the selected interpreter's `-m playwright install-deps chromium` if system-package installation is permitted. The renderer summarizes launch failures; to obtain details, launch Chromium directly through the selected backend without loading any captured traffic. Do not keep reinstalling Python packages for a missing system library. If a permission or network restriction prevents setup, state the failed dependency and the required access.

Once ready, invoke the renderer with that interpreter:

```bash
"$SCREENSHOT_MODE_CACHE/venv/bin/python" -B "$SKILL_DIR/scripts/render.py" \
  --request request.txt --response response.txt \
  --browser playwright --output evidence/run-001
```

All bundled scripts, fonts, styles, and templates travel with the skill. No Node project, Caido installation, proxy connector, or global Python package installation is required. For an explicitly requested HTML-only output, pass `--html-only` and skip browser setup.

## Report sizing

Choose the report's final image width before rendering. A full desktop-width image becomes harder to read when shrunk into a narrow document column.

`caido-a4` uses stacked panels at 595 CSS pixels and paginates at 12 logical lines per panel. `--width letter` uses 612 CSS pixels; integer widths are also accepted. `--font-size`, `--line-height`, and `--page-lines` tune the result. Pagination preserves whole logical lines, so wrapped values can make a sheet taller.

The bundled JetBrains Mono font loads before capture. PNG output uses 2x scale and 192 DPI metadata by default; `--scale 3` gives 3x and 288 DPI. At its intended CSS size, 14px text corresponds to 10.5pt. A 595px sheet at 2x is 1190 pixels wide, about 6.2 inches at 192 DPI when the document application honors image resolution. Preview it at the intended insertion size.

## Output and retries

Each exchange produces sanitized HTML and numbered PNG sheets. `manifest.json` records source and output hashes, presentation settings, formatting, rule match counts, and omissions. It does not contain traffic, rule patterns, or source filenames. Return the complete PNG paths and manifest after inspection.

Output directories must be new. A failed capture can leave partial sanitized files; retry in a new directory. Very tall images and enormous single lines can exceed browser or memory limits. Use pagination or smaller input batches if that happens. Never describe HTML-only or partial output as a completed PNG render.
