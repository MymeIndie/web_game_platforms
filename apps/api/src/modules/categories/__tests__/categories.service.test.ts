import { describe, it, expect, vi } from 'vitest';
import { CategoriesService } from '../categories.service';
import type { CategoriesRepository } from '../categories.repository';
import type { CategoryDto } from '../categories.dto';

/** DB 없이 서비스 계층 단위 테스트 — 리포지토리를 주입해 위임/DTO 계약 검증. */
describe('CategoriesService', () => {
  const sample: CategoryDto[] = [
    { id: 1, slug: 'action', name: 'Action', nameKo: '액션', icon: '🎮', sortOrder: 1, gameCount: 3 },
    { id: 2, slug: 'puzzle', name: 'Puzzle', nameKo: '퍼즐', icon: '🧩', sortOrder: 2, gameCount: 0 },
  ];

  function fakeRepo(rows: CategoryDto[]): CategoriesRepository {
    return { listWithGameCounts: vi.fn().mockResolvedValue(rows) } as unknown as CategoriesRepository;
  }

  it('listCategories: 리포지토리 결과(camelCase DTO)를 그대로 반환', async () => {
    const repo = fakeRepo(sample);
    const service = new CategoriesService(repo);

    const result = await service.listCategories();

    expect(result).toEqual(sample);
    expect(repo.listWithGameCounts).toHaveBeenCalledTimes(1);
  });

  it('gameCount 는 number, 키는 camelCase 계약을 만족', async () => {
    const service = new CategoriesService(fakeRepo(sample));

    const [first] = await service.listCategories();

    expect(typeof first.gameCount).toBe('number');
    expect(first).toHaveProperty('nameKo');
    expect(first).not.toHaveProperty('name_ko');
    expect(first).not.toHaveProperty('game_count');
  });

  it('빈 목록도 정상 반환', async () => {
    const service = new CategoriesService(fakeRepo([]));
    await expect(service.listCategories()).resolves.toEqual([]);
  });
});
