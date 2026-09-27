import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The partnerships page carried an invented office address, licence number
 * and phone number. Until real ones exist, the page shows placeholders.
 */
const source = readFileSync(join(__dirname, "page.tsx"), "utf8");

describe("partnerships page contact details", () => {
  it.each(["Prestige", "Palace Road", "560001", "2024-AD-BLR", "4555 9900"])("no longer contains %s", (text) => {
    expect(source).not.toContain(text);
  });

  it.each(["[Office address]", "[BBMP licence number]", "[Phone number]"])("shows the %s placeholder", (text) => {
    expect(source).toContain(text);
  });
});
