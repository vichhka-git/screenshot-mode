# Input contract and fidelity

## Raw HTTP

`--request request.txt --response response.txt` accepts full messages: start line, headers, blank line, body. Request-only input is allowed; use JSON for response-only input. A path of `-` reads stdin. Only one input can use stdin. CRLF is normalized to LF for display. Original files are never modified.

Headers retain order and duplicates except when explicitly hidden or redacted. Folded continuation lines follow their header's hide decision. Display control characters, bidi override/isolate characters, and invalid UTF-8 bytes become visible escapes. Images are a text representation, not a byte accurate transport dump.

Do not concatenate unrelated messages into a guessed pair. Put redirect chains, interim responses, and selected replay variants into separate exchange objects. Curl verbose diagnostics contain direction markers and runtime messages: save/export actual raw messages or normalize them into JSON before rendering. A reproduction command alone is insufficient.

## Exchange JSON

Pass `--exchange file.json`, or pipe JSON into `--exchange -`. One object or an array is accepted:

```json
{
  "request": "GET /api/account/42 HTTP/1.1\r\nHost: example.test\r\n\r\n",
  "response": "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"account_id\":42}",
  "metadata": {
    "url": "https://example.test/api/account/42",
    "sni": "example.test",
    "timestamp": "2026-01-01T00:00:00Z",
    "duration_ms": 31,
    "response_bytes": 17
  }
}
```

This is synthetic example data. Supply only metadata actually present in the capture. Each exchange must contain at least one string-valued `request` or `response`. Metadata is optional. Additional top-level fields are ignored. Only the listed metadata fields are displayed.

This contract works with raw exports from Burp, Caido, mitmproxy, ZAP, curl captures, and other tools. Native proxy project/session formats and Burp XML are not parsed directly. The tool independent boundary is full HTTP text, rather than integration with each proxy API.

## HAR

Use `--har traffic.har` to render all `log.entries`, or select a one-based `--entry 1`. Header arrays preserve their supplied order. The renderer constructs message start lines from captured fields and reads request `postData.text` and response `content.text`. Base64 response text is decoded; missing response bodies are labeled. Request form parameters without raw text are labeled as HAR records instead of reconstructed wire bodies.

When available, URL, startedDateTime, entry time, and response content size populate metadata. Missing protocol versions are labeled `HTTP/?`. An absent protocol version, body, original header ordering, HTTP/2 pseudo headers, TLS details, or transfer framing cannot be recovered from the export.

## Endpoint display

An explicitly supplied metadata URL or an absolute request target is shown directly. Otherwise the renderer displays Host plus path and states that the scheme was not captured. It never assumes HTTPS from a port or invents SNI. No captured URL is fetched.

## Limits

- Gzip/Brotli, chunk framing, multipart parts, and arbitrary character sets are not decoded automatically. Export decoded textual bodies when appropriate.
- Binary bodies are shown as decoded text with escapes, not image previews. Use another evidence representation if exact binary content matters.
- Pretty formatting operates on valid JSON and form-encoded text. JSON string/number tokens and duplicate keys are preserved; XML/HTML stay as escaped text.
- Rules match the normalized and optionally formatted display. Whitespace-sensitive patterns must match that view. Inline regex flags are supported; patterns run without an execution timeout, so avoid unbounded regexes on untrusted large bodies.
- Pagination counts logical lines per panel, repeats context on numbered sheets, and retains all lines unless a line range is explicitly selected. Wrapped lines stay on the same sheet. Sheet heights therefore vary, and a single enormous line can exceed browser capture limits.
- All documents are prepared in memory before output creation. Split unusually large exports into smaller captures if needed.
- Hashes in `manifest.json` identify input bytes and output artifacts. They do not authenticate the traffic source or verify a vulnerability.
