export const AnnotationTool = {
  Select: "select",
  Pen: "pen",
  Highlighter: "highlighter",
  Arrow: "arrow",
  Rectangle: "rectangle",
  Ellipse: "ellipse",
  Text: "text",
  Step: "step",
  Redact: "redact",
} as const;
export type AnnotationTool =
  (typeof AnnotationTool)[keyof typeof AnnotationTool];

export type AnnotationPoint = {
  x: number;
  y: number;
};

type AnnotationBase = {
  id: string;
  color: string;
  width: number;
};

type FreehandAnnotation = AnnotationBase & {
  type: "pen" | "highlighter";
  points: AnnotationPoint[];
};

type ShapeAnnotation = AnnotationBase & {
  type: "arrow" | "rectangle" | "ellipse" | "redact";
  start: AnnotationPoint;
  end: AnnotationPoint;
};

export type TextAnnotation = AnnotationBase & {
  type: "text";
  position: AnnotationPoint;
  text: string;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  underline?: boolean;
};

type StepAnnotation = AnnotationBase & {
  type: "step";
  position: AnnotationPoint;
  number: number;
  fontSize: number;
  fontFamily?: string;
};

export type Annotation =
  | FreehandAnnotation
  | ShapeAnnotation
  | TextAnnotation
  | StepAnnotation;

export type AnnotationCapture = {
  annotations: Annotation[];
  sourceWidth: number;
  sourceHeight: number;
};

export const ANNOTATION_COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#facc15", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#0f172a", label: "Black" },
  { value: "#ffffff", label: "White" },
] as const;

export const ANNOTATION_FONT_FAMILIES = [
  {
    label: "Inter",
    value: `Inter, ui-sans-serif, system-ui, sans-serif`,
  },
  {
    label: "Helvetica",
    value: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
  },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  {
    label: "Georgia",
    value: `Georgia, "Times New Roman", serif`,
  },
  {
    label: "Times New Roman",
    value: `"Times New Roman", Times, serif`,
  },
  {
    label: "Courier New",
    value: `"Courier New", Courier, monospace`,
  },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
] as const;

export const DEFAULT_ANNOTATION_FONT_FAMILY = ANNOTATION_FONT_FAMILIES[0].value;
export const DEFAULT_ANNOTATION_FONT_WEIGHT = 400;
export const DEFAULT_ANNOTATION_FONT_STYLE = "normal";
export const DEFAULT_ANNOTATION_UNDERLINE = false;

export const ANNOTATION_WIDTHS = [
  { value: 1, label: "1 px" },
  { value: 2, label: "2 px" },
  { value: 4, label: "4 px" },
  { value: 6, label: "6 px" },
  { value: 8, label: "8 px" },
  { value: 12, label: "12 px" },
] as const;

export const DEFAULT_ANNOTATION_COLOR = "#ef4444";
export const DEFAULT_ANNOTATION_WIDTH = 4;
export const DEFAULT_ANNOTATION_FONT_SIZE = 20;

export function getStepRadius(
  fontSize: number,
  step: number,
  scale = 1,
): number {
  const glyphSize = fontSize * 0.9 * scale;
  const textWidth = String(step).length * glyphSize * 0.62;
  const padding = Math.max(2, fontSize * 0.12) * scale;
  return Math.max(glyphSize * 0.58, textWidth * 0.55) + padding;
}

export function getTextFont(
  style: {
    fontSize: number;
    fontFamily?: string;
    fontWeight?: number;
    fontStyle?: "normal" | "italic";
  },
  scale = 1,
): string {
  return `${style.fontStyle ?? "normal"} ${style.fontWeight ?? 400} ${style.fontSize * scale}px ${style.fontFamily ?? DEFAULT_ANNOTATION_FONT_FAMILY}`;
}

export function getRect(
  start: AnnotationPoint,
  end: AnnotationPoint,
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function nextStepNumber(annotations: Annotation[]): number {
  return (
    annotations.filter((annotation) => annotation.type === "step").length + 1
  );
}

export function isShapeAnnotation(
  annotation: Annotation,
): annotation is ShapeAnnotation {
  return (
    annotation.type === "arrow" ||
    annotation.type === "rectangle" ||
    annotation.type === "ellipse" ||
    annotation.type === "redact"
  );
}

function getTextColor(color: string): string {
  const normalized = color.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => character + character)
          .join("")
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(value)) {
    return "#ffffff";
  }

  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.55 ? "#0f172a" : "#ffffff";
}

function drawFreehand(
  ctx: CanvasRenderingContext2D,
  annotation: FreehandAnnotation,
  width: number,
  height: number,
  scale: number,
): void {
  const first = annotation.points[0];
  if (first === undefined) {
    return;
  }

  const lineWidth = Math.max(1, annotation.width * scale);
  ctx.strokeStyle = annotation.color;
  ctx.fillStyle = annotation.color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (annotation.type === "highlighter") {
    ctx.globalAlpha = 0.35;
  }

  if (annotation.points.length === 1) {
    ctx.beginPath();
    ctx.arc(first.x * width, first.y * height, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(first.x * width, first.y * height);
  for (const point of annotation.points.slice(1)) {
    ctx.lineTo(point.x * width, point.y * height);
  }
  ctx.stroke();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  annotation: ShapeAnnotation,
  width: number,
  height: number,
  scale: number,
): void {
  const startX = annotation.start.x * width;
  const startY = annotation.start.y * height;
  const endX = annotation.end.x * width;
  const endY = annotation.end.y * height;

  if (annotation.type === "redact") {
    const rect = getRect(annotation.start, annotation.end);
    ctx.fillStyle = "#000000";
    ctx.fillRect(
      rect.x * width,
      rect.y * height,
      rect.width * width,
      rect.height * height,
    );
    return;
  }

  const lineWidth = Math.max(1, annotation.width * scale);
  ctx.strokeStyle = annotation.color;
  ctx.fillStyle = annotation.color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (annotation.type === "arrow") {
    const length = Math.hypot(endX - startX, endY - startY);
    if (length < 1) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const angle = Math.atan2(endY - startY, endX - startX);
    const headLength = Math.min(
      Math.max(10, annotation.width * 3) * scale,
      length * 0.6,
    );
    const spread = Math.PI / 7;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angle - spread),
      endY - headLength * Math.sin(angle - spread),
    );
    ctx.lineTo(
      endX - headLength * Math.cos(angle + spread),
      endY - headLength * Math.sin(angle + spread),
    );
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (annotation.type === "rectangle") {
    const rect = getRect(annotation.start, annotation.end);
    ctx.strokeRect(
      rect.x * width,
      rect.y * height,
      rect.width * width,
      rect.height * height,
    );
    return;
  }

  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;
  ctx.beginPath();
  ctx.ellipse(
    centerX,
    centerY,
    Math.abs(endX - startX) / 2,
    Math.abs(endY - startY) / 2,
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  annotation: TextAnnotation,
  width: number,
  height: number,
  scale: number,
): void {
  const fontSize = annotation.fontSize * scale;
  const x = annotation.position.x * width;
  const y = annotation.position.y * height;
  ctx.font = getTextFont(annotation, scale);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = annotation.color;
  ctx.fillText(annotation.text, x, y);

  if (annotation.underline === true) {
    const textWidth = ctx.measureText(annotation.text).width;
    ctx.fillRect(
      x,
      y + fontSize * 1.04,
      textWidth,
      Math.max(1, fontSize * 0.06),
    );
  }
}

function drawStep(
  ctx: CanvasRenderingContext2D,
  annotation: StepAnnotation,
  width: number,
  height: number,
  scale: number,
): void {
  const x = annotation.position.x * width;
  const y = annotation.position.y * height;
  const radius = getStepRadius(annotation.fontSize, annotation.number, scale);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = annotation.color;
  ctx.fill();

  ctx.fillStyle = getTextColor(annotation.color);
  ctx.font = `700 ${annotation.fontSize * 0.9 * scale}px ${annotation.fontFamily ?? DEFAULT_ANNOTATION_FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(annotation.number), x, y + 0.5 * scale);
}

export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  width: number,
  height: number,
  scale: number,
): void {
  for (const annotation of annotations) {
    ctx.save();

    if (annotation.type === "pen" || annotation.type === "highlighter") {
      drawFreehand(ctx, annotation, width, height, scale);
    } else if (annotation.type === "text") {
      drawText(ctx, annotation, width, height, scale);
    } else if (annotation.type === "step") {
      drawStep(ctx, annotation, width, height, scale);
    } else if (isShapeAnnotation(annotation)) {
      drawShape(ctx, annotation, width, height, scale);
    }

    ctx.restore();
  }
}
