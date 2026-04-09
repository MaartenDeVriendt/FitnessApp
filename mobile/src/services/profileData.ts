import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';

import { auth, db } from '../lib/firebase';
import type { UserProfile } from '../domain/fitness.models';

export type ProfileSaveInput = {
  nickname?: string;
  displayName?: string;
  bio?: string;
  heightCm?: number | null;
  weightKg?: number | null;
};

export function mergeProfileFromFirestore(user: User, raw?: Record<string, unknown>): UserProfile {
  const num = (v: unknown): number | null | undefined => {
    if (v == null) return undefined;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    uid: user.uid,
    email: user.email,
    displayName: (raw?.['displayName'] as string) ?? user.displayName ?? null,
    nickname: (raw?.['nickname'] as string) ?? null,
    bio: (raw?.['bio'] as string) ?? null,
    heightCm: num(raw?.['heightCm']) ?? null,
    weightKg: num(raw?.['weightKg']) ?? null,
    createdAt: raw?.['createdAt'] as Timestamp | Date | undefined,
    updatedAt: raw?.['updatedAt'] as Timestamp | Date | undefined,
  };
}

export function useProfile(user: User | null): UserProfile | null {
  const [p, setP] = useState<UserProfile | null>(null);
  useEffect(() => {
    if (!user) {
      setP(null);
      return;
    }
    const uid = user.uid;
    const d = doc(db, 'users', uid);
    return onSnapshot(d, (snap) => {
      const u = auth.currentUser;
      if (!u || u.uid !== uid) return;
      setP(mergeProfileFromFirestore(u, snap.data() as Record<string, unknown> | undefined));
    });
  }, [user?.uid]);
  return p;
}

export async function saveProfileRemote(input: ProfileSaveInput): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be signed in to save your profile.');
  await setDoc(
    doc(db, 'users', uid),
    {
      nickname: input.nickname?.trim() ? input.nickname.trim() : null,
      displayName: input.displayName?.trim() ? input.displayName.trim() : null,
      bio: input.bio?.trim() ? input.bio.trim() : null,
      heightCm: input.heightCm == null || Number.isNaN(Number(input.heightCm)) ? null : Number(input.heightCm),
      weightKg: input.weightKg == null || Number.isNaN(Number(input.weightKg)) ? null : Number(input.weightKg),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
