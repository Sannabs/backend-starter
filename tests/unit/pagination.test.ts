import { getPagination, paginated } from "../../src/lib/pagination.js";

describe("getPagination", () => {
  it("defaults to page 1, limit 20", () => {
    expect(getPagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("reads page and limit from the query string", () => {
    expect(getPagination({ page: "3", limit: "50" })).toEqual({
      page: 3,
      limit: 50,
      skip: 100,
    });
  });

  it("caps limit at 100 so one caller cannot ask for the whole table", () => {
    expect(getPagination({ limit: "5000" }).limit).toBe(100);
  });

  it.each([["0"], ["-3"], ["abc"], [""]])("clamps page %s to 1", (page) => {
    expect(getPagination({ page }).page).toBe(1);
  });

  it("falls back to the default when limit is absent or unparseable", () => {
    expect(getPagination({ limit: "abc" }).limit).toBe(20);
    expect(getPagination({ limit: "0" }).limit).toBe(20);
  });

  /**
   * `Math.min(Number("-5") || 20, 100)` was -5, because -5 is truthy — a negative
   * `take` reached Prisma. The floor now sits next to the cap.
   */
  it("never returns a negative limit", () => {
    expect(getPagination({ limit: "-5" }).limit).toBeGreaterThan(0);
  });

  it("never returns a negative skip", () => {
    expect(getPagination({ page: "-2", limit: "-5" }).skip).toBeGreaterThanOrEqual(0);
  });
});

describe("paginated", () => {
  const pagination = { page: 3, limit: 20, skip: 40 };

  it("reports the page count and whether more remain", () => {
    const { pagination: meta } = paginated([], 45, pagination);

    expect(meta.totalPages).toBe(3);
    expect(meta.hasNextPage).toBe(false);
  });

  it("flags a next page when rows remain beyond the window", () => {
    expect(paginated([], 61, pagination).pagination.hasNextPage).toBe(true);
  });

  it("handles an empty result without claiming a page", () => {
    const { pagination: meta } = paginated([], 0, { page: 1, limit: 20, skip: 0 });

    expect(meta.totalPages).toBe(0);
    expect(meta.hasNextPage).toBe(false);
  });
});
