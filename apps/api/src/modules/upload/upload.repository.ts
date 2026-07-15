/**
 * Upload 리포지토리 — games 테이블에서 소유권 조회 + 처리상태 전이.
 * SQL 은 리포지토리 안에서만 (CONVENTIONS). BaseRepository 상속.
 * NOTE: games 모듈(Lane 2)이 아닌 upload 소유 파일에서 games 를 읽는 이유:
 *   업로드 complete 의 소유권 검증/상태전이는 upload 흐름의 일부이며,
 *   여기서 필요한 것은 developer_id 조회 + status='processing' 전이뿐(읽기/좁은 쓰기)이다.
 */
import { BaseRepository } from '../../infra/db/base.repository';

interface GameOwnerRow {
  developer_id: string | null;
}

export class UploadRepository extends BaseRepository {
  /**
   * 게임 소유자(developer_id) 조회.
   * @returns null = 게임 없음, { ownerId } = 존재(소유자 미지정이면 ownerId=null)
   */
  async findGameOwner(gameId: string): Promise<{ ownerId: string | null } | null> {
    const row = await this.queryOne<GameOwnerRow>(
      `SELECT developer_id FROM games WHERE id = $1`,
      [gameId]
    );
    if (row === null) return null;
    return { ownerId: row.developer_id };
  }

  /** 멀티파트 완료 후: zip 경로 기록 + 처리중 상태로 전이(잡 큐가 이어받음). */
  async markProcessing(gameId: string, zipKey: string): Promise<void> {
    await this.query(
      `UPDATE games SET zip_path = $1, status = 'processing', updated_at = NOW() WHERE id = $2`,
      [zipKey, gameId]
    );
  }
}
