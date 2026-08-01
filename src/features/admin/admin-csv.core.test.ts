import { describe, expect, it } from "vitest";

import { csvField, csvRow } from "./admin-csv.core";

describe("csvField", () => {
  it("passes plain values through untouched", () => {
    expect(csvField("Ana")).toBe("Ana");
    expect(csvField(42)).toBe("42");
    expect(csvField(0)).toBe("0");
  });

  it("renders null/undefined as an empty field", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });

  it("quotes and escapes fields containing commas, quotes or newlines", () => {
    expect(csvField("Ana, Beatriz")).toBe('"Ana, Beatriz"');
    expect(csvField('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes CSV/formula injection by prefixing a leading quote before =, +, -, @", () => {
    expect(csvField("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1");
    expect(csvField("+1234")).toBe("'+1234");
    expect(csvField("-1234")).toBe("'-1234");
    expect(csvField("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
  });

  it("does not treat a value merely containing = in the middle as a formula", () => {
    expect(csvField("a=b")).toBe("a=b");
  });
});

describe("csvRow", () => {
  it("joins fields with commas and terminates with CRLF", () => {
    expect(csvRow(["a", "b", 1])).toBe("a,b,1\r\n");
  });

  it("quotes only the fields that need it within a row", () => {
    expect(csvRow(["Ana, Beatriz", "ok"])).toBe('"Ana, Beatriz",ok\r\n');
  });
});
