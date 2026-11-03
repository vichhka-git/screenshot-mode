import { domToPng } from "modern-screenshot";

import { type AnnotationCapture, drawAnnotations } from "@/utils/annotations";

function shouldIncludeNode(node: Node): boolean {
  if (node instanceof HTMLElement) {
    // Exclude CodeMirror internal widget buffer images that can't be rendered
    if (node.classList.contains("cm-widgetBuffer")) {
      return false;
    }

    // Annotations are composited separately at full resolution
    if (node.classList.contains("screenshot-annotation-ui")) {
      return false;
    }
  }
  return true;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  // eslint-disable-next-line compat/compat -- image loading needs a promise
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Could not load the captured image"));
    image.src = dataUrl;
  });
}

async function compositeAnnotations(
  dataUrl: string,
  capture: AnnotationCapture,
): Promise<string> {
  if (capture.sourceWidth <= 0 || capture.sourceHeight <= 0) {
    throw new Error("Could not measure the screenshot area");
  }

  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error("Could not create the annotation canvas");
  }

  ctx.drawImage(image, 0, 0);
  drawAnnotations(
    ctx,
    capture.annotations,
    canvas.width,
    canvas.height,
    canvas.width / capture.sourceWidth,
  );

  return canvas.toDataURL("image/png");
}

async function renderElement(
  element: HTMLElement,
  annotationCapture?: AnnotationCapture,
): Promise<string> {
  const dataUrl = await domToPng(element, {
    scale: 2,
    filter: shouldIncludeNode,
    features: {
      restoreScrollPosition: true,
    },
  });

  if (
    annotationCapture === undefined ||
    annotationCapture.annotations.length === 0
  ) {
    return dataUrl;
  }

  return compositeAnnotations(dataUrl, annotationCapture);
}

function downloadDataUrl(dataUrl: string): void {
  const blob = dataUrlToBlob(dataUrl);
  // eslint-disable-next-line compat/compat -- createObjectURL/revokeObjectURL for reliable download filename
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "screenshot.png";
  link.click();
  // eslint-disable-next-line compat/compat
  URL.revokeObjectURL(url);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch?.[1] ?? "image/png";
  const base64Data = parts[1] ?? "";
  const binary = atob(base64Data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

export async function captureAndDownload(
  element: HTMLElement,
  annotationCapture?: AnnotationCapture,
): Promise<{ success: boolean; error?: string }> {
  try {
    const dataUrl = await renderElement(element, annotationCapture);
    downloadDataUrl(dataUrl);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function captureAndCopyToClipboard(
  element: HTMLElement,
  annotationCapture?: AnnotationCapture,
): Promise<{ success: boolean; error?: string }> {
  try {
    const dataUrl = await renderElement(element, annotationCapture);
    const blob = dataUrlToBlob(dataUrl);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
