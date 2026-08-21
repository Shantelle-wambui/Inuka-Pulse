/** Auth & user management types for Inuka Pulse backend API */

export interface AuthResponse {
  token: string;
  name: string;
  email: string;
  role: string;
  userId: number;
}

export interface InukaUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string;
  lastLoginAt: string | null;
}

export interface InukaRole {
  id: number;
  name: string;
  description: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: string;
}

// Backwards-compat aliases — remove after all consumers are updated
/** @deprecated Use InukaUser */
export type SentinelUser = InukaUser;
/** @deprecated Use InukaRole */
export type SentinelRole = InukaRole;
