import { describe, it, expect } from 'vitest';
import { paging, PAGE_SIZE } from './paging';

describe('paging — the box grows once capture lands', () => {
  it('always reports at least one page, even for an empty box', () => {
    expect(paging(0, 0).pageCount).toBe(1);
    expect(paging(0, 0).start).toBe(0);
  });

  it('keeps a full single page on one page', () => {
    expect(paging(PAGE_SIZE, 0).pageCount).toBe(1);
  });

  it('rolls over to a second page one past the limit', () => {
    // The size the old note claimed broke the scene outright.
    expect(paging(PAGE_SIZE + 1, 0).pageCount).toBe(2);
  });

  it('clamps a page index past the end back onto the last page', () => {
    // Reachable for real: retiring parents shrinks the box under the viewer.
    const p = paging(PAGE_SIZE + 1, 99);
    expect(p.page).toBe(1);
    expect(p.start).toBe(PAGE_SIZE);
  });

  it('clamps a negative page to the first', () => {
    expect(paging(50, -3).page).toBe(0);
  });

  it('slices the last page short rather than past the end', () => {
    const p = paging(PAGE_SIZE + 3, 1);
    expect(p.start).toBe(PAGE_SIZE);
    expect(p.end).toBe(PAGE_SIZE + 3);
  });

  it('reports whether there is anywhere to page to', () => {
    expect(paging(5, 0).hasPrev).toBe(false);
    expect(paging(5, 0).hasNext).toBe(false);
    const first = paging(PAGE_SIZE * 3, 0);
    expect(first.hasPrev).toBe(false);
    expect(first.hasNext).toBe(true);
    const middle = paging(PAGE_SIZE * 3, 1);
    expect(middle.hasPrev).toBe(true);
    expect(middle.hasNext).toBe(true);
    const last = paging(PAGE_SIZE * 3, 2);
    expect(last.hasPrev).toBe(true);
    expect(last.hasNext).toBe(false);
  });

  it('scales to a box far larger than anything reachable today', () => {
    const p = paging(500, 41);
    expect(p.pageCount).toBe(Math.ceil(500 / PAGE_SIZE));
    expect(p.end - p.start).toBeLessThanOrEqual(PAGE_SIZE);
  });
});
