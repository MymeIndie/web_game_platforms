/**
 * 워커 잡이 게임 레코드 상태를 갱신하기 위한 리포지토리.
 * SQL 은 리포지토리 안에서만(CONVENTIONS §1). 워커/서비스는 이 메서드만 호출한다.
 * modules/games(Lane 2)를 건드리지 않고 잡 경계에서 필요한 최소 쓰기만 담당.
 */
import { BaseRepository } from '../infra/db/base.repository';

export class GameStatusRepository extends BaseRepository {
  /** 성공: 게임을 활성화하고 서빙 경로(prefix)를 기록. */
  async markActive(gameId: string, gamePath: string): Promise<void> {
    await this.query(
      `UPDATE games SET game_path = $1, status = 'active', updated_at = NOW() WHERE id = $2`,
      [gamePath, gameId]
    );
  }

  /** 실패(최종): 게임을 비활성화. 재시도 성공 시 markActive 로 최종 상태가 정정됨. */
  async markInactive(gameId: string): Promise<void> {
    await this.query(
      `UPDATE games SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
      [gameId]
    );
  }
}
