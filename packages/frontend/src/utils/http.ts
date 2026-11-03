type HttpMessage = {
  head: string;
  separator: string;
  body: string;
};

const CRLF_SEPARATOR = "\r\n\r\n";
const LF_SEPARATOR = "\n\n";

export function splitHttpMessage(raw: string): HttpMessage {
  const crlfIndex = raw.indexOf(CRLF_SEPARATOR);
  const lfIndex = raw.indexOf(LF_SEPARATOR);

  if (crlfIndex !== -1 && (lfIndex === -1 || crlfIndex < lfIndex)) {
    return {
      head: raw.substring(0, crlfIndex),
      separator: CRLF_SEPARATOR,
      body: raw.substring(crlfIndex + CRLF_SEPARATOR.length),
    };
  }

  if (lfIndex !== -1) {
    return {
      head: raw.substring(0, lfIndex),
      separator: LF_SEPARATOR,
      body: raw.substring(lfIndex + LF_SEPARATOR.length),
    };
  }

  return { head: raw, separator: "", body: "" };
}

function getHeaderValue(head: string, headerName: string): string | undefined {
  const normalizedName = headerName.toLowerCase();
  const lines = head.split(/\r?\n/);

  for (let index = 1; index < lines.length; index++) {
    const line = lines[index];
    if (line === undefined) {
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex <= 0) {
      continue;
    }

    if (line.substring(0, colonIndex).trim().toLowerCase() === normalizedName) {
      return line.substring(colonIndex + 1).trim();
    }
  }

  return undefined;
}

export function getContentType(head: string): string | undefined {
  const value = getHeaderValue(head, "content-type");
  if (value === undefined) {
    return undefined;
  }

  return value.split(";")[0]?.trim().toLowerCase();
}
