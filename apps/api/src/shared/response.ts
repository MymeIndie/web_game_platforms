/**
 * 표준 응답 래퍼. 모든 라우트는 ok()/fail() 로만 응답 바디를 만든다 (CONVENTIONS).
 * 기존 계약 { success, data, error } 를 그대로 유지 — 프론트 호환 보존.
 */
import type { Response } from 'express';

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export function ok<T>(res: Response, data: T, status = 200): Response {
  const body: ApiEnvelope<T> = { success: true, data };
  return res.status(status).json(body);
}

export function okMessage(res: Response, message: string, status = 200): Response {
  const body: ApiEnvelope<never> = { success: true, message };
  return res.status(status).json(body);
}

export function fail(res: Response, status: number, error: string): Response {
  const body: ApiEnvelope<never> = { success: false, error };
  return res.status(status).json(body);
}
