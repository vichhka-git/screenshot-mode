import { describe, expect, it } from "vitest";

import { formatRenderError } from "./render";

describe("formatRenderError", () => {
  it("explains how to install the rendering engine", () => {
    expect(
      formatRenderError({
        __typename: "RenderFailedUserError",
        code: "RENDER_FAILED",
        reason: "NO_BROWSER",
      }),
    ).toContain("Settings → Rendering");
  });

  it("handles a response without a body", () => {
    expect(
      formatRenderError({
        __typename: "RenderFailedUserError",
        code: "RENDER_FAILED",
        reason: "NO_DATA",
      }),
    ).toBe("This response has no body to preview.");
  });

  it("handles rendering timeouts", () => {
    expect(
      formatRenderError({
        __typename: "RenderFailedUserError",
        code: "RENDER_FAILED",
        reason: "TIMEOUT",
      }),
    ).toBe("The rendering engine timed out. Try again.");
  });

  it("handles internal rendering failures", () => {
    expect(
      formatRenderError({
        __typename: "RenderFailedUserError",
        code: "RENDER_FAILED",
        reason: "INTERNAL",
      }),
    ).toBe("The rendering engine failed to render this response.");
  });

  it("falls back for unknown rendering failures", () => {
    expect(
      formatRenderError({
        __typename: "RenderFailedUserError",
        code: "RENDER_FAILED",
        reason: "UNKNOWN",
      }),
    ).toBe("Unable to render this response.");
  });

  it("includes the code from other user errors", () => {
    expect(
      formatRenderError({
        __typename: "OtherUserError",
        code: "UNKNOWN_ID",
      }),
    ).toBe("Unable to render this response (UNKNOWN_ID).");
  });
});
