import { describe, expect, it } from "vitest";
import { getLibraryPageSearch, parseLibraryPageParam } from "./home";

describe("Library pagination URL state", () => {
  it.each([
    [null, 1],
    ["", 1],
    ["invalid", 1],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["9007199254740992", Number.MAX_SAFE_INTEGER],
    ["1", 1],
    ["24", 24],
  ])("resolves page parameter %s to %i", (value, expectedPage) => {
    expect(parseLibraryPageParam(value)).toBe(expectedPage);
  });

  it("preserves unrelated URL state while changing the page", () => {
    const search = getLibraryPageSearch(
      "?filter=kind&sort=title&page=8&filter=style",
      3,
    );
    const params = new URLSearchParams(search);

    expect(params.get("page")).toBe("3");
    expect(params.get("sort")).toBe("title");
    expect(params.getAll("filter")).toEqual(["kind", "style"]);
  });
});
