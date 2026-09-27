import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import ListingDescription from "./ListingDescription";

afterEach(() => cleanup());

describe("ListingDescription (P0-2)", () => {
  it("renders blank-line separated text as paragraphs", () => {
    const { container } = render(<ListingDescription text={"First paragraph.\n\nSecond paragraph."} />);
    const paragraphs = [...container.querySelectorAll("p")].map((p) => p.textContent);
    expect(paragraphs).toEqual(["First paragraph.", "Second paragraph."]);
  });

  it("renders markup-looking text as text, never as HTML", () => {
    const { container } = render(<ListingDescription text={"<p>Skywalk</p> <b>bold</b>"} />);
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("ignores empty paragraphs", () => {
    const { container } = render(<ListingDescription text={"\n\nOnly one.\n\n\n\n"} />);
    expect([...container.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["Only one."]);
  });
});
