import { describe, expect, it } from "vitest";

import {
  type Annotation,
  getRect,
  getStepRadius,
  getTextFont,
  getTextPadding,
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

describe("getStepRadius", () => {
  it("grows with the font size and extra digits", () => {
    expect(getStepRadius(40, 1)).toBeGreaterThan(getStepRadius(20, 1));
    expect(getStepRadius(20, 10)).toBeGreaterThan(getStepRadius(20, 1));
  });
});

describe("getTextFont", () => {
  it("uses the selected family, weight, style, and scale", () => {
    expect(
      getTextFont(
        {
          fontSize: 24,
          fontFamily: "Georgia",
          fontWeight: 700,
          fontStyle: "italic",
        },
        2,
      ),
    ).toBe("italic 700 48px Georgia");
  });

  it("falls back to the default annotation font", () => {
    expect(getTextFont({ fontSize: 20 })).toContain("400 20px Inter");
  });
});

describe("getTextPadding", () => {
  it("keeps a minimum and grows with the font size", () => {
    expect(getTextPadding(6)).toBe(4);
    expect(getTextPadding(40)).toBeGreaterThan(getTextPadding(20));
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
