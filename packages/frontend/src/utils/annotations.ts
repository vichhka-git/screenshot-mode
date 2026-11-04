export const AnnotationTool = {
  Select: "select",
  Pen: "pen",
  Highlighter: "highlighter",
  Line: "line",
  Arrow: "arrow",
  OutlineArrow: "outline-arrow",
  Rectangle: "rectangle",
  RoundedRectangle: "rounded-rectangle",
  Ellipse: "ellipse",
  Triangle: "triangle",
  Star: "star",
  Polygon: "polygon",
  Heart: "heart",
  SpeechBubble: "speech-bubble",
  ThoughtBubble: "thought-bubble",
  Text: "text",
  Step: "step",
  Redact: "redact",
} as const;
export type AnnotationTool =
  (typeof AnnotationTool)[keyof typeof AnnotationTool];

const SHAPE_KINDS = [
  "line",
  "arrow",
  "outline-arrow",
  "rectangle",
  "rounded-rectangle",
  "ellipse",
  "triangle",
  "star",
  "polygon",
  "heart",
  "speech-bubble",
  "thought-bubble",
  "redact",
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

type LineShapeKind = "line" | "arrow" | "outline-arrow";

const LINE_SHAPES: LineShapeKind[] = ["line", "arrow", "outline-arrow"];

function isShapeKind(value: string): value is ShapeKind {
  return (SHAPE_KINDS as readonly string[]).includes(value);
}

export function isShapeTool(tool: AnnotationTool): tool is ShapeKind {
  return isShapeKind(tool);
}

export function isLineShape(
  annotation: Annotation,
): annotation is ShapeAnnotation & { type: LineShapeKind } {
  return LINE_SHAPES.includes(annotation.type as LineShapeKind);
}

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
  type: ShapeKind;
  start: AnnotationPoint;
  end: AnnotationPoint;
  filled?: boolean;
  dashed?: boolean;
  arrowStart?: boolean;
  arrowEnd?: boolean;
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
  indent?: number;
  boxed?: boolean;
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
export const DEFAULT_ANNOTATION_INDENT = 0;
export const DEFAULT_ANNOTATION_BOXED = false;

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

export function getTextPadding(fontSize: number): number {
  return Math.max(4, fontSize * 0.28);
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
  return isShapeKind(annotation.type);
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

function setShapeStroke(
  ctx: CanvasRenderingContext2D,
  annotation: ShapeAnnotation,
  scale: number,
): void {
  ctx.strokeStyle = annotation.color;
  ctx.lineWidth = Math.max(1, annotation.width * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (annotation.dashed === true) {
    const dash = Math.max(4, annotation.width * 2.5) * scale;
    ctx.setLineDash([dash, dash * 0.7]);
  }
}

function paintShapePath(
  ctx: CanvasRenderingContext2D,
  annotation: ShapeAnnotation,
): void {
  if (annotation.filled === true) {
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = annotation.color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.stroke();
}

function getArrowHeadLength(
  annotation: ShapeAnnotation,
  scale: number,
  lineLength: number,
): number {
  return Math.min(
    Math.max(14, annotation.width * 6) * scale,
    lineLength * 0.35,
  );
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  annotation: ShapeAnnotation,
  scale: number,
  lineLength: number,
  outline: boolean,
): void {
  const headLength = getArrowHeadLength(annotation, scale, lineLength);
  if (headLength < 2) {
    return;
  }

  const halfWidth = headLength * 0.58;
  const backX = x - headLength * Math.cos(angle);
  const backY = y - headLength * Math.sin(angle);

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    backX + Math.sin(angle) * halfWidth,
    backY - Math.cos(angle) * halfWidth,
  );
  ctx.lineTo(
    backX - Math.sin(angle) * halfWidth,
    backY + Math.cos(angle) * halfWidth,
  );
  ctx.closePath();

  if (outline) {
    ctx.stroke();
  } else {
    ctx.fillStyle = annotation.color;
    ctx.fill();
  }
}

function drawBigArrow(
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
  const length = Math.hypot(endX - startX, endY - startY);
  if (length < 1) {
    return;
  }

  const angle = Math.atan2(endY - startY, endX - startX);
  const normalX = -Math.sin(angle);
  const normalY = Math.cos(angle);
  const headLength = Math.min(
    length * 0.32,
    Math.max(18 * scale, annotation.width * 6 * scale),
  );
  const shaftWidth = Math.max(
    10 * scale,
    Math.min(length * 0.2, annotation.width * 4 * scale + 8 * scale),
  );
  const headWidth = shaftWidth * 1.9;
  const backX = endX - Math.cos(angle) * headLength;
  const backY = endY - Math.sin(angle) * headLength;

  setShapeStroke(ctx, annotation, scale);
  ctx.beginPath();
  ctx.moveTo(
    startX + normalX * (shaftWidth / 2),
    startY + normalY * (shaftWidth / 2),
  );
  ctx.lineTo(
    backX + normalX * (shaftWidth / 2),
    backY + normalY * (shaftWidth / 2),
  );
  ctx.lineTo(
    backX + normalX * (headWidth / 2),
    backY + normalY * (headWidth / 2),
  );
  ctx.lineTo(endX, endY);
  ctx.lineTo(
    backX - normalX * (headWidth / 2),
    backY - normalY * (headWidth / 2),
  );
  ctx.lineTo(
    backX - normalX * (shaftWidth / 2),
    backY - normalY * (shaftWidth / 2),
  );
  ctx.lineTo(
    startX - normalX * (shaftWidth / 2),
    startY - normalY * (shaftWidth / 2),
  );
  ctx.closePath();
  paintShapePath(ctx, annotation);
}

function drawLineShape(
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
  const length = Math.hypot(endX - startX, endY - startY);
  if (length < 1) {
    return;
  }

  if (annotation.type === "outline-arrow") {
    drawBigArrow(ctx, annotation, width, height, scale);
    return;
  }

  const angle = Math.atan2(endY - startY, endX - startX);
  const drawStart =
    annotation.type === "line" && annotation.arrowStart === true;
  const drawEnd =
    annotation.type === "arrow" ||
    (annotation.type === "line" && annotation.arrowEnd === true);
  const headLength = getArrowHeadLength(annotation, scale, length);

  setShapeStroke(ctx, annotation, scale);
  ctx.beginPath();
  ctx.moveTo(
    startX + (drawStart ? Math.cos(angle) * headLength : 0),
    startY + (drawStart ? Math.sin(angle) * headLength : 0),
  );
  ctx.lineTo(
    endX - (drawEnd ? Math.cos(angle) * headLength : 0),
    endY - (drawEnd ? Math.sin(angle) * headLength : 0),
  );
  ctx.stroke();

  if (drawStart) {
    drawArrowHead(
      ctx,
      startX,
      startY,
      angle + Math.PI,
      annotation,
      scale,
      length,
      false,
    );
  }

  if (drawEnd) {
    drawArrowHead(ctx, endX, endY, angle, annotation, scale, length, false);
  }
}

function drawClosedShape(
  ctx: CanvasRenderingContext2D,
  annotation: ShapeAnnotation,
  width: number,
  height: number,
  scale: number,
): void {
  const rect = getRect(annotation.start, annotation.end);
  const x = rect.x * width;
  const y = rect.y * height;
  const shapeWidth = rect.width * width;
  const shapeHeight = rect.height * height;

  if (shapeWidth < 1 || shapeHeight < 1) {
    return;
  }

  const centerX = x + shapeWidth / 2;
  const centerY = y + shapeHeight / 2;
  const radius = Math.min(shapeWidth, shapeHeight) * 0.16;

  setShapeStroke(ctx, annotation, scale);
  ctx.beginPath();

  switch (annotation.type) {
    case "rectangle":
      ctx.rect(x, y, shapeWidth, shapeHeight);
      break;
    case "rounded-rectangle":
      ctx.roundRect(x, y, shapeWidth, shapeHeight, radius);
      break;
    case "ellipse":
      ctx.ellipse(
        centerX,
        centerY,
        shapeWidth / 2,
        shapeHeight / 2,
        0,
        0,
        Math.PI * 2,
      );
      break;
    case "triangle":
      ctx.moveTo(centerX, y);
      ctx.lineTo(x + shapeWidth, y + shapeHeight);
      ctx.lineTo(x, y + shapeHeight);
      ctx.closePath();
      break;
    case "star": {
      const outer = Math.min(shapeWidth, shapeHeight) / 2;
      const inner = outer * 0.46;
      for (let index = 0; index < 10; index += 1) {
        const angle = -Math.PI / 2 + (index * Math.PI) / 5;
        const distance = index % 2 === 0 ? outer : inner;
        const pointX = centerX + Math.cos(angle) * distance;
        const pointY = centerY + Math.sin(angle) * distance;
        if (index === 0) {
          ctx.moveTo(pointX, pointY);
        } else {
          ctx.lineTo(pointX, pointY);
        }
      }
      ctx.closePath();
      break;
    }
    case "polygon": {
      const outer = Math.min(shapeWidth, shapeHeight) / 2;
      for (let index = 0; index < 6; index += 1) {
        const angle = -Math.PI / 2 + (index * Math.PI) / 3;
        const pointX = centerX + Math.cos(angle) * outer;
        const pointY = centerY + Math.sin(angle) * outer;
        if (index === 0) {
          ctx.moveTo(pointX, pointY);
        } else {
          ctx.lineTo(pointX, pointY);
        }
      }
      ctx.closePath();
      break;
    }
    case "heart":
      ctx.moveTo(centerX, y + shapeHeight);
      ctx.bezierCurveTo(
        x + shapeWidth * 0.15,
        y + shapeHeight * 0.7,
        x,
        y + shapeHeight * 0.45,
        x,
        y + shapeHeight * 0.28,
      );
      ctx.bezierCurveTo(
        x,
        y + shapeHeight * 0.1,
        x + shapeWidth * 0.15,
        y,
        x + shapeWidth * 0.3,
        y,
      );
      ctx.bezierCurveTo(
        x + shapeWidth * 0.4,
        y,
        x + shapeWidth * 0.47,
        y + shapeHeight * 0.05,
        centerX,
        y + shapeHeight * 0.13,
      );
      ctx.bezierCurveTo(
        x + shapeWidth * 0.53,
        y + shapeHeight * 0.05,
        x + shapeWidth * 0.6,
        y,
        x + shapeWidth * 0.7,
        y,
      );
      ctx.bezierCurveTo(
        x + shapeWidth * 0.85,
        y,
        x + shapeWidth,
        y + shapeHeight * 0.1,
        x + shapeWidth,
        y + shapeHeight * 0.28,
      );
      ctx.bezierCurveTo(
        x + shapeWidth,
        y + shapeHeight * 0.45,
        x + shapeWidth * 0.85,
        y + shapeHeight * 0.7,
        centerX,
        y + shapeHeight,
      );
      ctx.closePath();
      break;
    case "speech-bubble": {
      const bodyHeight = shapeHeight * 0.78;
      ctx.roundRect(x, y, shapeWidth, bodyHeight, radius);
      ctx.moveTo(x + shapeWidth * 0.22, y + bodyHeight);
      ctx.lineTo(x + shapeWidth * 0.3, y + shapeHeight);
      ctx.lineTo(x + shapeWidth * 0.44, y + bodyHeight);
      break;
    }
    case "thought-bubble": {
      const mainRadiusX = shapeWidth * 0.42;
      const mainRadiusY = shapeHeight * 0.3;
      ctx.ellipse(
        centerX + shapeWidth * 0.05,
        y + shapeHeight * 0.38,
        mainRadiusX,
        mainRadiusY,
        0,
        0,
        Math.PI * 2,
      );
      const bubbles: [number, number, number][] = [
        [0.3, 0.78, 0.08],
        [0.2, 0.89, 0.055],
        [0.12, 0.97, 0.035],
      ];
      for (const [bubbleX, bubbleY, bubbleRadius] of bubbles) {
        const radiusX = shapeWidth * bubbleRadius;
        const radiusY = shapeHeight * bubbleRadius;
        const pointX = x + shapeWidth * bubbleX;
        const pointY = y + shapeHeight * bubbleY;
        ctx.moveTo(pointX + radiusX, pointY);
        ctx.ellipse(pointX, pointY, radiusX, radiusY, 0, 0, Math.PI * 2);
      }
      break;
    }
    default:
      return;
  }

  paintShapePath(ctx, annotation);
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  annotation: ShapeAnnotation,
  width: number,
  height: number,
  scale: number,
): void {
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

  if (isLineShape(annotation)) {
    drawLineShape(ctx, annotation, width, height, scale);
    return;
  }

  drawClosedShape(ctx, annotation, width, height, scale);
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
  const indent = (annotation.indent ?? 0) * scale;
  const padding = getTextPadding(annotation.fontSize) * scale;
  ctx.font = getTextFont(annotation, scale);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const textWidth = ctx.measureText(annotation.text).width;
  const textX = x + indent;

  if (annotation.boxed === true) {
    const boxWidth = textWidth + indent + padding * 2;
    const boxHeight = fontSize * 1.25 + padding * 2;
    ctx.beginPath();
    ctx.roundRect(
      x - padding,
      y - padding,
      boxWidth,
      boxHeight,
      Math.max(4 * scale, fontSize * 0.35),
    );
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = annotation.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1, fontSize * 0.05);
    ctx.strokeStyle = annotation.color;
    ctx.stroke();
  }

  ctx.fillStyle = annotation.color;
  ctx.fillText(annotation.text, textX, y);

  if (annotation.underline === true) {
    ctx.fillRect(
      textX,
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
