import { describe, expect, it } from "vitest";

import { formatBody, formatHttpMessage, formatMarkup } from "./format";

import { ViewMode } from "@/types";

describe("formatBody", () => {
  it("pretty prints JSON content types", () => {
    expect(formatBody('{"name":"value","count":2}', "application/json")).toBe(
      '{\n  "name": "value",\n  "count": 2\n}',
    );
  });

  it("pretty prints JSON suffix content types", () => {
    expect(formatBody('{"name":"value"}', "application/vnd.api+json")).toBe(
      '{\n  "name": "value"\n}',
    );
  });

  it("returns invalid JSON unchanged", () => {
    expect(formatBody("{not json", "application/json")).toBe("{not json");
  });

  it("formats form bodies one field per line", () => {
    expect(
      formatBody("a=1&b=2&c=three", "application/x-www-form-urlencoded"),
    ).toBe("a=1\nb=2\nc=three");
  });

  it("sniffs JSON when the content type is missing", () => {
    expect(formatBody('{"a":1}', undefined)).toBe('{\n  "a": 1\n}');
  });

  it("sniffs HTML when the content type is missing", () => {
    expect(formatBody("<html><body><p>x</p></body></html>", undefined)).toBe(
      "<html>\n  <body>\n    <p>x</p>\n  </body>\n</html>",
    );
  });

  it("leaves unknown content types untouched", () => {
    expect(formatBody("plain text", "text/plain")).toBe("plain text");
  });

  it("preserves an empty body", () => {
    expect(formatBody("", "application/json")).toBe("");
  });
});

describe("formatMarkup", () => {
  it("indents nested HTML", () => {
    const source =
      "<html><head><title>301 Moved</title></head><body><h1>301</h1></body></html>";

    expect(formatMarkup(source, "html")).toBe(
      [
        "<html>",
        "  <head>",
        "    <title>301 Moved</title>",
        "  </head>",
        "  <body>",
        "    <h1>301</h1>",
        "  </body>",
        "</html>",
      ].join("\n"),
    );
  });

  it("formats an uppercase HTML response", () => {
    const source =
      '<HTML><HEAD><meta http-equiv="content-type" content="text/html; charset=utf-8"><TITLE>301 Moved</TITLE></HEAD><BODY><H1>301 Moved</H1>The document has moved<A HREF="https://www.google.com/">here</A>.</BODY></HTML>';

    expect(formatMarkup(source, "html")).toBe(
      [
        "<HTML>",
        "  <HEAD>",
        '    <meta http-equiv="content-type" content="text/html; charset=utf-8">',
        "    <TITLE>301 Moved</TITLE>",
        "  </HEAD>",
        "  <BODY>",
        "    <H1>301 Moved</H1>",
        '    The document has moved<A HREF="https://www.google.com/">here</A>.',
        "  </BODY>",
        "</HTML>",
      ].join("\n"),
    );
  });

  it("keeps inline HTML elements on the same line", () => {
    const source = '<p>Hello <a href="/x">here</a>!</p>';

    expect(formatMarkup(source, "html")).toBe(
      ["<p>", '  Hello <a href="/x">here</a>!', "</p>"].join("\n"),
    );
  });

  it("indents nested XML elements", () => {
    const source =
      "<Response><Code>InvalidArgument</Code><Message>Bad request</Message></Response>";

    expect(formatMarkup(source, "xml")).toBe(
      [
        "<Response>",
        "  <Code>InvalidArgument</Code>",
        "  <Message>Bad request</Message>",
        "</Response>",
      ].join("\n"),
    );
  });

  it("preserves script content", () => {
    const source = "<html><script>if (a < b) { run(); }</script></html>";

    expect(formatMarkup(source, "html")).toBe(
      [
        "<html>",
        "  <script>",
        "    if (a < b) { run(); }",
        "  </script>",
        "</html>",
      ].join("\n"),
    );
  });
});

describe("formatHttpMessage", () => {
  const raw = [
    "HTTP/1.1 200 OK",
    "Content-Type: application/json",
    "",
    '{"a":1}',
  ].join("\r\n");

  it("returns the raw message in raw mode", () => {
    expect(formatHttpMessage(raw, ViewMode.Raw)).toBe(raw);
  });

  it("formats the body and keeps the head in pretty mode", () => {
    const body = ["{", '  "a": 1', "}"].join("\n");

    expect(formatHttpMessage(raw, ViewMode.Pretty)).toBe(
      `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n${body}`,
    );
  });

  it("uses the supplied content type over the headers", () => {
    const request = [
      "GET / HTTP/1.1",
      "Host: example.com",
      "",
      "<html><body><p>x</p></body></html>",
    ].join("\r\n");
    const body = [
      "<html>",
      "  <body>",
      "    <p>x</p>",
      "  </body>",
      "</html>",
    ].join("\n");

    expect(formatHttpMessage(request, ViewMode.Pretty, "text/html")).toBe(
      `GET / HTTP/1.1\r\nHost: example.com\r\n\r\n${body}`,
    );
  });

  it("returns messages without a body unchanged", () => {
    const head = "GET / HTTP/1.1\r\nHost: example.com";

    expect(formatHttpMessage(head, ViewMode.Pretty)).toBe(head);
  });
});
