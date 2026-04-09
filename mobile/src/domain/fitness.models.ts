import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  nickname?: string | null;
  bio?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}
