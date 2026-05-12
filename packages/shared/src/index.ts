// ==========================================
// Shared Types for wgp-gonggam Platform
// ==========================================

// --- User & Auth ---
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'developer' | 'user';
  createdAt: string;
  updatedAt: string;
}

export interface AuthPayload {
  userId: string;
  email: string;
  role: User['role'];
}

// --- Category ---
export interface Category {
  id: number;
  slug: string;
  name: string;
  nameKo: string;
  icon: string;
  gameCount?: number;
}

// --- Game ---
export type GameStatus = 'pending' | 'processing' | 'active' | 'inactive';

export interface Game {
  id: string;
  title: string;
  titleKo?: string;
  description: string;
  descriptionKo?: string;
  thumbnailUrl: string;
  previewVideoUrl?: string;
  gamePath: string;       // COS path to extracted game folder (e.g., "games/{id}/")
  zipPath?: string;       // COS path to original .zip
  categoryId: number;
  category?: Category;
  developerId: string;
  developer?: User;
  status: GameStatus;
  plays: number;
  rating: number;
  ratingCount: number;
  tags: string[];
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GameListItem extends Pick<Game,
  'id' | 'title' | 'titleKo' | 'thumbnailUrl' | 'previewVideoUrl' |
  'categoryId' | 'category' | 'plays' | 'rating' | 'status' | 'createdAt'
> {}

// --- Upload ---
export interface InitiateUploadRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface InitiateUploadResponse {
  uploadId: string;
  key: string;
  bucket: string;
}

export interface GetPartUrlRequest {
  key: string;
  uploadId: string;
  partNumber: number;
}

export interface GetPartUrlResponse {
  presignedUrl: string;
}

export interface CompletePart {
  PartNumber: number;
  ETag: string;
}

export interface CompleteUploadRequest {
  key: string;
  uploadId: string;
  parts: CompletePart[];
  gameId?: string;
}

export interface CompleteUploadResponse {
  location: string;
  key: string;
}

// --- API Response Wrapper ---
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// --- Game Form (Console) ---
export interface CreateGameDto {
  title: string;
  titleKo?: string;
  description: string;
  descriptionKo?: string;
  categoryId: number;
  tags?: string[];
  width?: number;
  height?: number;
}

export interface UpdateGameDto extends Partial<CreateGameDto> {
  status?: GameStatus;
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  gamePath?: string;
  zipPath?: string;
}
