/**
 * games 서비스 단위 테스트 — 페이크 레포지토리로 DB 없이 비즈니스 규칙 검증.
 * - PATCH 화이트리스트(과다필드 폐기)
 * - 평점 범위 검증(1~5) + 집계 재계산
 * - list clamp / not-found 매핑
 */
import { describe, it, expect, vi } from 'vitest';
import { GamesService } from './games.service';
import type { GamesRepository } from './games.repository';
import { BadRequestError, NotFoundError } from '../../shared/errors';

function fakeRepo(over: Partial<GamesRepository> = {}): GamesRepository {
  return {
    list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    findById: vi.fn(),
    findDeveloperId: vi.fn(),
    getStatus: vi.fn(),
    create: vi.fn(),
    updateById: vi.fn(),
    updateThumbnail: vi.fn(),
    deleteById: vi.fn(),
    incrementPlays: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn(),
    upsertRating: vi.fn().mockResolvedValue(undefined),
    aggregate: vi.fn(),
    applyAggregate: vi.fn().mockResolvedValue(undefined),
    findUserRating: vi.fn(),
    ...over,
  } as unknown as GamesRepository;
}

describe('GamesService.updateGame — 화이트리스트', () => {
  it('허용되지 않은 필드(developer_id, plays, role)는 폐기하고 허용 필드만 전달', async () => {
    const updateById = vi.fn().mockResolvedValue({ id: 'g1', title: 'ok' });
    const svc = new GamesService(fakeRepo({ updateById }));

    await svc.updateGame('g1', {
      title: 'new',
      developerId: 'attacker', // 폐기
      plays: 99999, // 폐기
      role: 'admin', // 폐기
      status: 'active', // 허용
    });

    const [, columns, values] = updateById.mock.calls[0];
    expect(columns).toEqual(['title', 'status']);
    expect(values).toEqual(['new', 'active']);
  });

  it('유효 필드가 하나도 없으면 BadRequestError', async () => {
    const svc = new GamesService(fakeRepo());
    await expect(svc.updateGame('g1', { bogus: 1, plays: 5 })).rejects.toBeInstanceOf(BadRequestError);
  });

  it('대상 없으면 NotFoundError', async () => {
    const svc = new GamesService(fakeRepo({ updateById: vi.fn().mockResolvedValue(null) }));
    await expect(svc.updateGame('g1', { title: 'x' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('GamesService.rateGame — 평점', () => {
  it('범위 밖(0, 6, NaN)은 BadRequestError', async () => {
    const svc = new GamesService(fakeRepo({ exists: vi.fn().mockResolvedValue(true) }));
    await expect(svc.rateGame('g1', 'u1', 0)).rejects.toBeInstanceOf(BadRequestError);
    await expect(svc.rateGame('g1', 'u1', 6)).rejects.toBeInstanceOf(BadRequestError);
    await expect(svc.rateGame('g1', 'u1', 'abc')).rejects.toBeInstanceOf(BadRequestError);
  });

  it('없는 게임에 평점 → NotFoundError', async () => {
    const svc = new GamesService(fakeRepo({ exists: vi.fn().mockResolvedValue(false) }));
    await expect(svc.rateGame('g1', 'u1', 5)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('유효 평점은 upsert + 집계 재계산 후 결과 반환', async () => {
    const applyAggregate = vi.fn().mockResolvedValue(undefined);
    const svc = new GamesService(
      fakeRepo({
        exists: vi.fn().mockResolvedValue(true),
        aggregate: vi.fn().mockResolvedValue({ avg_rating: '4.50', count: '2' }),
        applyAggregate,
      })
    );

    const out = await svc.rateGame('g1', 'u1', 5);
    expect(out).toEqual({ yourRating: 5, avgRating: 4.5, ratingCount: 2 });
    expect(applyAggregate).toHaveBeenCalledWith('g1', 4.5, 2);
  });
});

describe('GamesService.listGames — clamp/매핑', () => {
  it('limit 은 50 상한, page 는 1 하한으로 clamp', async () => {
    const list = vi.fn().mockResolvedValue({ rows: [{ title_ko: '게임' }], total: 1 });
    const svc = new GamesService(fakeRepo({ list }));

    const res = await svc.listGames({ page: '0', limit: '999' });
    const filter = list.mock.calls[0][0];
    expect(filter.limit).toBe(50);
    expect(res.page).toBe(1);
    // rowToDto: snake→camel 매핑 확인(raw row 반환 금지)
    expect(res.items[0]).toEqual({ titleKo: '게임' });
  });

  it('알 수 없는 sort 는 plays 로 폴백', async () => {
    const list = vi.fn().mockResolvedValue({ rows: [], total: 0 });
    const svc = new GamesService(fakeRepo({ list }));
    await svc.listGames({ sort: 'DROP TABLE' });
    expect(list.mock.calls[0][0].sort).toBe('plays');
  });
});

describe('GamesService.getGame — 상세', () => {
  it('없으면 NotFoundError', async () => {
    const svc = new GamesService(fakeRepo({ findById: vi.fn().mockResolvedValue(null) }));
    await expect(svc.getGame('g1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('있으면 조회수 증가(fire-and-forget) + DTO 반환', async () => {
    const incrementPlays = vi.fn().mockResolvedValue(undefined);
    const svc = new GamesService(
      fakeRepo({ findById: vi.fn().mockResolvedValue({ id: 'g1', title_ko: '게임' }), incrementPlays })
    );
    const out = await svc.getGame('g1');
    expect(out).toEqual({ id: 'g1', titleKo: '게임' });
    expect(incrementPlays).toHaveBeenCalledWith('g1');
  });
});
