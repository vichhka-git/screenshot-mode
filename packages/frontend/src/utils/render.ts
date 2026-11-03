export const RENDER_WIDTH = 1200;
export const RENDER_HEIGHT = 1024;

type RenderError = {
  __typename: string;
  code: string;
  reason?: string;
};

export function formatRenderError(error: RenderError): string {
  if (error.__typename === "RenderFailedUserError") {
    switch (error.reason) {
      case "NO_BROWSER":
        return "The rendering engine is not installed. Install it from Caido's Settings → Rendering tab.";
      case "NO_DATA":
        return "This response has no body to preview.";
      case "TIMEOUT":
        return "The rendering engine timed out. Try again.";
      case "INTERNAL":
        return "The rendering engine failed to render this response.";
      default:
        return "Unable to render this response.";
    }
  }

  return `Unable to render this response (${error.code}).`;
}
