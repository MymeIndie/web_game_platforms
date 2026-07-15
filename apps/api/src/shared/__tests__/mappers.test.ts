import { describe, it, expect } from 'vitest';
import { snakeToCamel, camelToSnake, rowToDto, dtoToColumns } from '../mappers';

describe('mappers (snake ↔ camel 계약)', () => {
  it('snakeToCamel', () => {
    expect(snakeToCamel('title_ko')).toBe('titleKo');
    expect(snakeToCamel('preview_video_url')).toBe('previewVideoUrl');
    expect(snakeToCamel('id')).toBe('id');
  });

  it('camelToSnake', () => {
    expect(camelToSnake('titleKo')).toBe('title_ko');
    expect(camelToSnake('previewVideoUrl')).toBe('preview_video_url');
  });

  it('rowToDto: DB row → DTO', () => {
    const row = { id: '1', title_ko: '게임', rating_count: 3 };
    expect(rowToDto(row)).toEqual({ id: '1', titleKo: '게임', ratingCount: 3 });
  });

  it('dtoToColumns: 화이트리스트 밖 필드 제거(IDOR/과다필드 방지)', () => {
    const dto = { titleKo: '새 제목', role: 'admin', status: 'active' };
    const allowed = ['title_ko', 'status'] as const;
    const { columns, values } = dtoToColumns(dto, allowed);
    expect(columns).toEqual(['title_ko', 'status']);
    expect(values).toEqual(['새 제목', 'active']);
  });
});
