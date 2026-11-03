import { getContentType, splitHttpMessage } from "./http";

import { ViewMode } from "@/types";

const HTML_TYPES = new Set(["text/html", "application/xhtml+xml"]);
const XML_TYPES = new Set([
  "application/xml",
  "text/xml",
  "application/rss+xml",
  "application/atom+xml",
  "application/soap+xml",
  "image/svg+xml",
]);

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const INLINE_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "button",
  "cite",
  "code",
  "data",
  "dfn",
  "em",
  "i",
  "img",
  "input",
  "kbd",
  "label",
  "mark",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "select",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
]);

const RAW_CONTENT_TAGS = new Set(["script", "style", "pre", "textarea"]);

type MarkupToken =
  | {
      type: "tag";
      value: string;
      name: string;
      closing: boolean;
      selfClosing: boolean;
    }
  | { type: "text"; value: string; raw: boolean }
  | { type: "comment"; value: string };

type MarkupTagToken = Extract<MarkupToken, { type: "tag" }>;

function isJsonType(contentType: string | undefined): boolean {
  if (contentType === undefined) {
    return false;
  }

  return (
    contentType === "application/json" ||
    contentType === "text/json" ||
    contentType.endsWith("+json")
  );
}

function isHtmlType(contentType: string | undefined): boolean {
  return contentType !== undefined && HTML_TYPES.has(contentType);
}

function isXmlType(contentType: string | undefined): boolean {
  if (contentType === undefined) {
    return false;
  }

  return XML_TYPES.has(contentType) || contentType.endsWith("+xml");
}

function formatJson(body: string): string | undefined {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return undefined;
  }
}

function formatFormBody(body: string): string {
  return body.split("&").join("\n");
}

function findTagEnd(source: string, startIndex: number): number {
  let quote: string | undefined = undefined;

  for (let index = startIndex + 1; index < source.length; index++) {
    const character = source[index];

    if (quote !== undefined) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === ">") {
      return index;
    }
  }

  return -1;
}

function parseTag(raw: string): MarkupTagToken | undefined {
  const inner = raw.substring(1, raw.length - 1).trim();
  const closing = inner.startsWith("/");
  const content = closing ? inner.substring(1).trim() : inner;
  const selfClosing = content.endsWith("/");
  const name = content.match(/^([a-zA-Z][a-zA-Z0-9:_-]*)/)?.[1]?.toLowerCase();

  if (name === undefined) {
    return undefined;
  }

  return {
    type: "tag",
    value: raw,
    name,
    closing,
    selfClosing,
  };
}

function tokenizeMarkup(source: string): MarkupToken[] {
  const tokens: MarkupToken[] = [];
  let index = 0;

  function pushText(value: string, raw = false): void {
    if (value.length > 0) {
      tokens.push({ type: "text", value, raw });
    }
  }

  while (index < source.length) {
    const tagStart = source.indexOf("<", index);
    if (tagStart === -1) {
      pushText(source.substring(index));
      break;
    }

    if (tagStart > index) {
      pushText(source.substring(index, tagStart));
    }

    if (source.startsWith("<!--", tagStart)) {
      const commentEnd = source.indexOf("-->", tagStart + 4);
      if (commentEnd === -1) {
        pushText(source.substring(tagStart));
        break;
      }

      tokens.push({
        type: "comment",
        value: source.substring(tagStart, commentEnd + 3),
      });
      index = commentEnd + 3;
      continue;
    }

    if (source.startsWith("<![CDATA[", tagStart)) {
      const cdataEnd = source.indexOf("]]>", tagStart + 9);
      if (cdataEnd === -1) {
        pushText(source.substring(tagStart), true);
        break;
      }

      pushText(source.substring(tagStart, cdataEnd + 3), true);
      index = cdataEnd + 3;
      continue;
    }

    const tagEnd = findTagEnd(source, tagStart);
    if (tagEnd === -1) {
      pushText(source.substring(tagStart));
      break;
    }

    const rawTag = source.substring(tagStart, tagEnd + 1);
    const token = parseTag(rawTag);
    index = tagEnd + 1;

    if (token === undefined) {
      pushText(rawTag);
      continue;
    }

    tokens.push(token);

    if (
      token.closing ||
      token.selfClosing ||
      !RAW_CONTENT_TAGS.has(token.name)
    ) {
      continue;
    }

    const closingTag = new RegExp(`</${token.name}\\s*>`, "i");
    const remaining = source.substring(index);
    const closingMatch = closingTag.exec(remaining);
    if (closingMatch === null) {
      continue;
    }

    pushText(remaining.substring(0, closingMatch.index), true);
    tokens.push({
      type: "tag",
      value: closingMatch[0],
      name: token.name,
      closing: true,
      selfClosing: false,
    });
    index += closingMatch.index + closingMatch[0].length;
  }

  return tokens;
}

function findTextOnlyElement(
  tokens: MarkupToken[],
  openIndex: number,
): { text: string; closeValue: string; endIndex: number } | undefined {
  const opening = tokens[openIndex];
  if (opening?.type !== "tag" || opening.closing) {
    return undefined;
  }

  let text = "";

  for (let index = openIndex + 1; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === undefined) {
      return undefined;
    }

    if (token.type === "text") {
      text += token.value;
      continue;
    }

    if (token.type === "comment") {
      return undefined;
    }

    if (token.closing && token.name === opening.name) {
      return { text, closeValue: token.value, endIndex: index };
    }

    return undefined;
  }

  return undefined;
}

function appendText(
  lines: string[],
  current: { value: string },
  text: string,
  raw: boolean,
  indent: string,
): void {
  if (raw) {
    if (current.value.trim().length > 0) {
      lines.push(`${indent}${current.value.trim()}`);
      current.value = "";
    }

    const content = text.replace(/^\r?\n+/, "").replace(/\r?\n+$/, "");
    if (content.length > 0) {
      for (const line of content.split(/\r?\n/)) {
        lines.push(line.length > 0 ? `${indent}${line}` : "");
      }
    }
    return;
  }

  const normalized = text.replace(/\s+/g, " ");
  if (normalized.trim().length === 0) {
    if (current.value.length > 0) {
      current.value += " ";
    }
    return;
  }

  if (current.value.length === 0) {
    current.value = normalized.trimStart();
    return;
  }

  current.value += normalized;
}

export function formatMarkup(source: string, mode: "html" | "xml"): string {
  if (source.trim().length === 0) {
    return source;
  }

  const tokens = tokenizeMarkup(source);
  const lines: string[] = [];
  const current = { value: "" };
  let indentLevel = 0;

  function indent(): string {
    return "  ".repeat(indentLevel);
  }

  function flush(): void {
    const value = current.value.trim();
    if (value.length > 0) {
      lines.push(`${indent()}${value}`);
    }
    current.value = "";
  }

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }

    if (token.type === "text") {
      appendText(lines, current, token.value, token.raw, indent());
      continue;
    }

    if (token.type === "comment") {
      flush();
      lines.push(`${indent()}${token.value}`);
      continue;
    }

    if (token.name === "!doctype" || token.value.startsWith("<!")) {
      flush();
      lines.push(`${indent()}${token.value}`);
      continue;
    }

    const inline = mode === "html" && INLINE_TAGS.has(token.name);

    if (token.closing) {
      if (inline) {
        current.value += token.value;
        continue;
      }

      flush();
      indentLevel = Math.max(0, indentLevel - 1);
      lines.push(`${indent()}${token.value}`);
      continue;
    }

    if (token.selfClosing || (mode === "html" && VOID_TAGS.has(token.name))) {
      if (inline) {
        current.value += token.value;
      } else {
        flush();
        lines.push(`${indent()}${token.value}`);
      }
      continue;
    }

    if (!RAW_CONTENT_TAGS.has(token.name) && !inline) {
      const textOnly = findTextOnlyElement(tokens, index);
      if (textOnly !== undefined) {
        const text = textOnly.text.replace(/\s+/g, " ").trim();
        flush();
        lines.push(`${indent()}${token.value}${text}${textOnly.closeValue}`);
        index = textOnly.endIndex;
        continue;
      }
    }

    if (inline) {
      current.value += token.value;
      continue;
    }

    flush();
    lines.push(`${indent()}${token.value}`);
    indentLevel++;
  }

  flush();

  return lines.join("\n");
}

export function formatBody(
  body: string,
  contentType: string | undefined,
): string {
  if (body.trim().length === 0) {
    return body;
  }

  if (isJsonType(contentType)) {
    return formatJson(body) ?? body;
  }

  if (isHtmlType(contentType)) {
    return formatMarkup(body, "html");
  }

  if (isXmlType(contentType)) {
    return formatMarkup(body, "xml");
  }

  if (contentType === "application/x-www-form-urlencoded") {
    return formatFormBody(body);
  }

  if (contentType === undefined) {
    const trimmed = body.trimStart();
    const json = formatJson(body);
    if (
      json !== undefined &&
      (trimmed.startsWith("{") || trimmed.startsWith("["))
    ) {
      return json;
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith("<!doctype html") || lower.startsWith("<html")) {
      return formatMarkup(body, "html");
    }
  }

  return body;
}

export function formatHttpMessage(
  raw: string,
  mode: ViewMode,
  contentType: string | undefined = undefined,
): string {
  if (mode === ViewMode.Raw) {
    return raw;
  }

  const message = splitHttpMessage(raw);
  if (message.separator.length === 0) {
    return raw;
  }

  const type = contentType ?? getContentType(message.head);
  return `${message.head}${message.separator}${formatBody(message.body, type)}`;
}
