export type UserRole = 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
export type UserTier = 'FREE' | 'FOUNDER';
export type CardStatus = 'PENDING' | 'ACTIVE' | 'DEACTIVATED' | 'REJECTED';
export type ConnectionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
export type EventType = 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
export type RegistrationStatus = 'REGISTERED' | 'ATTENDED' | 'CANCELLED' | 'WAITLISTED';
export type NotificationType =
  | 'CONNECTION_REQUEST'
  | 'CONNECTION_ACCEPTED'
  | 'EVENT_REMINDER'
  | 'FOUNDER_CARD_APPROVED'
  | 'FOUNDER_CARD_REJECTED'
  | 'NEW_EVENT'
  | 'BADGE_EARNED'
  | 'LEVEL_UP'
  | 'SYSTEM';
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'ARCHIVED';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  tier: UserTier;
  iat?: number;
  exp?: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ValidationErrorDetail[];
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
  filename?: string;
  destination?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface QRPayload {
  userId: string;
  type: 'founder_card' | 'profile';
  timestamp: number;
}

export interface ScoreAction {
  action: string;
  points: number;
  metadata?: Record<string, unknown>;
}

export interface DashboardStats {
  totalUsers: number;
  totalEvents: number;
  activeFounderCards: number;
  totalConnections: number;
  monthlyGrowth: {
    users: number;
    events: number;
    connections: number;
  };
}
