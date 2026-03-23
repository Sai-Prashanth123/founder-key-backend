// User Roles
export enum UserRole {
  ATTENDEE = 'ATTENDEE',
  ORGANIZER = 'ORGANIZER',
  ADMIN = 'ADMIN',
}

// User Tiers
export enum UserTier {
  FREE = 'FREE',
  FOUNDER = 'FOUNDER',
}

// Card Statuses
export enum CardStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED',
  REJECTED = 'REJECTED',
}

// Connection Statuses
export enum ConnectionStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

// Event Statuses
export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

// Event Types
export enum EventType {
  IN_PERSON = 'IN_PERSON',
  VIRTUAL = 'VIRTUAL',
  HYBRID = 'HYBRID',
}

// Registration Statuses
export enum RegistrationStatus {
  REGISTERED = 'REGISTERED',
  ATTENDED = 'ATTENDED',
  CANCELLED = 'CANCELLED',
  WAITLISTED = 'WAITLISTED',
}

// Notification Types
export enum NotificationType {
  CONNECTION_REQUEST = 'CONNECTION_REQUEST',
  CONNECTION_ACCEPTED = 'CONNECTION_ACCEPTED',
  EVENT_REMINDER = 'EVENT_REMINDER',
  FOUNDER_CARD_APPROVED = 'FOUNDER_CARD_APPROVED',
  FOUNDER_CARD_REJECTED = 'FOUNDER_CARD_REJECTED',
  NEW_EVENT = 'NEW_EVENT',
  BADGE_EARNED = 'BADGE_EARNED',
  LEVEL_UP = 'LEVEL_UP',
  SYSTEM = 'SYSTEM',
}

// Lead Statuses
export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  CONVERTED = 'CONVERTED',
  ARCHIVED = 'ARCHIVED',
}

// Gamification Score Values
export const SCORE_VALUES = {
  PROFILE_COMPLETE: 50,
  EVENT_REGISTERED: 20,
  EVENT_ATTENDED: 50,
  CONNECTION_MADE: 10,
  FOUNDER_CARD_ACTIVE: 100,
  QR_SCAN: 5,
  BADGE_EARNED: 25,
  FIRST_LOGIN: 10,
  PROFILE_PHOTO_ADDED: 15,
} as const;

// Gamification Level Thresholds
export const LEVEL_THRESHOLDS = [
  { level: 1, minScore: 0, label: 'Newcomer' },
  { level: 2, minScore: 100, label: 'Explorer' },
  { level: 3, minScore: 250, label: 'Networker' },
  { level: 4, minScore: 500, label: 'Connector' },
  { level: 5, minScore: 1000, label: 'Influencer' },
  { level: 6, minScore: 1500, label: 'Builder' },
  { level: 7, minScore: 2500, label: 'Innovator' },
  { level: 8, minScore: 4000, label: 'Visionary' },
  { level: 9, minScore: 6000, label: 'Pioneer' },
  { level: 10, minScore: 10000, label: 'Legend' },
] as const;

// Badge Names
export const BADGE_NAMES = {
  FIRST_CONNECTION: 'First Connection',
  NETWORK_STARTER: 'Network Starter',
  SUPER_CONNECTOR: 'Super Connector',
  EVENT_GOER: 'Event Goer',
  EVENT_ENTHUSIAST: 'Event Enthusiast',
  FOUNDER_BADGE: 'Founder',
  PROFILE_CHAMPION: 'Profile Champion',
  QR_MASTER: 'QR Master',
  EARLY_ADOPTER: 'Early Adopter',
  COMMUNITY_PILLAR: 'Community Pillar',
} as const;

// Redis Key Prefixes
export const REDIS_KEYS = {
  REFRESH_TOKEN: 'refresh_token:',
  EMAIL_VERIFY: 'email_verify:',
  PASSWORD_RESET: 'password_reset:',
  SOCKET_USER: 'socket:user:',
  RATE_LIMIT: 'rate_limit:',
  SESSION: 'session:',
} as const;

// Token Expiry (seconds)
export const TOKEN_TTL = {
  EMAIL_VERIFY: 24 * 60 * 60, // 24 hours
  PASSWORD_RESET: 15 * 60, // 15 minutes
  REFRESH_TOKEN: 7 * 24 * 60 * 60, // 7 days
} as const;

// Pagination Defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// File Upload
export const UPLOAD = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  AVATAR_SIZE: 256,
  COVER_WIDTH: 1200,
  COVER_HEIGHT: 630,
} as const;
