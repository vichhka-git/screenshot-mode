# Bundled code font

JetBrains Mono Regular, version 2.304, from the upstream JetBrainsMono release:

- Font: https://github.com/JetBrains/JetBrainsMono/blob/v2.304/fonts/webfonts/JetBrainsMono-Regular.woff2
- License: [SIL Open Font License 1.1](OFL.txt)

The renderer embeds this font as a data URI in each HTML artifact so code metrics do not depend on installed operating system fonts. `font_family: "system"` opts into system monospace instead. Caido's editor font depends on the host application and its settings; this font gives the standalone renderer consistent code metrics.
