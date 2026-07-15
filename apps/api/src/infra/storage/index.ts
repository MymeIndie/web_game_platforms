/**
 * StoragePort 팩토리 — config.storage.driver 로 어댑터 선택.
 * 서비스는 getStorage() 로만 스토리지를 얻는다 (직접 어댑터 import 금지 — CONVENTIONS).
 */
import { config } from '../../shared/env';
import type { StoragePort } from './storage.port';
import { CosAdapter } from './cos.adapter';
import { R2Adapter } from './r2.adapter';

let instance: StoragePort | null = null;

export function getStorage(): StoragePort {
  if (instance) return instance;
  switch (config.storage.driver) {
    case 'cos':
      instance = new CosAdapter();
      break;
    case 'r2':
    case 's3':
      instance = new R2Adapter();
      break;
    default:
      throw new Error(`Unknown STORAGE_DRIVER: ${config.storage.driver}`);
  }
  return instance;
}

export type { StoragePort, UploadedPart } from './storage.port';
