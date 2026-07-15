/**
 * DB(snake_case) ↔ DTO(camelCase) 변환 단일 소스.
 * - 라우트가 DB raw row 를 그대로 반환하는 것 금지. 반드시 매퍼를 거친다 (CONVENTIONS).
 * - 이게 죽어있던 @wgp/shared 타입 계약(camelCase)을 실제로 살리는 접점.
 */

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** DB row(snake) → DTO(camel). 얕은 변환. 값은 그대로.
 *  입력은 object 로 완화 — 타입된 Row 인터페이스(인덱스시그니처 없음)도 받도록. */
export function rowToDto<T = Record<string, unknown>>(row: object): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[snakeToCamel(k)] = v;
  return out as T;
}

export function rowsToDto<T = Record<string, unknown>>(rows: readonly object[]): T[] {
  return rows.map((r) => rowToDto<T>(r));
}

/** DTO(camel) → DB 컬럼(snake). 화이트리스트로 안전하게 (SQL 주입/과다필드 방지). */
export function dtoToColumns(
  dto: Record<string, unknown>,
  allowed: readonly string[]
): { columns: string[]; values: unknown[] } {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(dto)) {
    const col = camelToSnake(k);
    if (allowed.includes(col)) {
      columns.push(col);
      values.push(v);
    }
  }
  return { columns, values };
}
