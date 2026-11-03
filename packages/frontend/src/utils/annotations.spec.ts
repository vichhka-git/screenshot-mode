import { describe, expect, it } from "vitest";

import {
  type Annotation,
  getAnnotationFontSize,
  getRect,
  isShapeAnnotation,
  nextStepNumber,
} from "@/utils/annotations";

const base = {
  id: "annotation",
  color: "#ef4444",
  width: 4,
};

function step(number: number): Annotation {
  return {
    ...base,
    type: "step",
    position: { x: 0.5, y: 0.5 },
    number,
    fontSize: 20,
  };
}

describe("getRect", () => {
  it("normalizes a drag from bottom right to top left", () => {
    expect(getRect({ x: 0.8, y: 0.6 }, { x: 0.2, y: 0.1 })).toEqual({
      x: 0.2,
      y: 0.1,
      width: 0.6000000000000001,
      height: 0.5,
    });
  });
});

describe("nextStepNumber", () => {
  it("counts existing steps", () => {
    expect(nextStepNumber([step(1), step(2)])).toBe(3);
  });

  it("ignores other annotation types", () => {
    const arrow: Annotation = {
      ...base,
      type: "arrow",
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    };

    expect(nextStepNumber([arrow, step(1)])).toBe(2);
  });
});

describe("getAnnotationFontSize", () => {
  it("grows with the stroke width", () => {
    expect(getAnnotationFontSize(2)).toBe(18);
    expect(getAnnotationFontSize(7)).toBe(33);
  });
});

describe("isShapeAnnotation", () => {
  it("accepts every shape type", () => {
    const types = ["arrow", "rectangle", "ellipse", "redact"] as const;

    for (const type of types) {
      expect(
        isShapeAnnotation({
          ...base,
          type,
          start: { x: 0, y: 0 },
          end: { x: 1, y: 1 },
        }),
      ).toBe(true);
    }
  });

  it("rejects freehand and text annotations", () => {
    expect(
      isShapeAnnotation({
        ...base,
        type: "pen",
        points: [{ x: 0, y: 0 }],
      }),
    ).toBe(false);

    expect(
      isShapeAnnotation({
        ...base,
        type: "text",
        position: { x: 0, y: 0 },
        text: "Proof",
        fontSize: 20,
      }),
    ).toBe(false);
  });
});
