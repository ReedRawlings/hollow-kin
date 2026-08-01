/**
 * Page arithmetic for grid screens.
 *
 * Deliberately free of any Phaser import so it can be unit-tested — scene modules
 * pull in Phaser, which needs a DOM and cannot load under the node test runner.
 * That is why this is a module and not a method on the scene.
 */

/** Cards per page in the creature box: a 4-wide by 3-tall grid. */
export const PAGE_SIZE = 12;

/** Columns in that grid. Shared so the layout and the keyboard row-step cannot drift. */
export const GRID_COLS = 4;

export interface Paging {
  /** Never below 1, so an empty box still reads "PAGE 1/1". */
  pageCount: number;
  /** `requested`, clamped into range. */
  page: number;
  start: number;
  end: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Resolve a requested page against a collection of `total` items.
 *
 * Clamping matters in both directions and both are reachable: breeding retires two
 * parents, so the box can shrink out from under a viewer sitting on the last page,
 * and capture will make it grow past one page for the first time.
 */
export function paging(total: number, requested: number, pageSize = PAGE_SIZE): Paging {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(0, Math.min(pageCount - 1, requested));
  const start = page * pageSize;
  return {
    pageCount,
    page,
    start,
    end: Math.min(total, start + pageSize),
    hasPrev: page > 0,
    hasNext: page < pageCount - 1,
  };
}
