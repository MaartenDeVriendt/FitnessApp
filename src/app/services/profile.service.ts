import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { doc, docData, Firestore, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { User } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import type { UserProfile } from '../models/fitness.models';

export type ProfileSaveInput = {
  nickname?: string;
  displayName?: string;
  bio?: string;
  heightCm?: number | null;
  weightKg?: number | null;
};

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  /** Signed-in user’s merged Firestore profile + Auth fields; `null` when signed out. */
  readonly profile$: Observable<UserProfile | null> = authState(this.auth).pipe(
    switchMap((user) => {
      if (!user) return of<UserProfile | null>(null);
      const d = doc(this.firestore, 'users', user.uid);
      return docData(d).pipe(map((raw) => this.mergeFromFirestore(user, raw as Record<string, unknown> | undefined)));
    }),
  );

  async saveProfile(input: ProfileSaveInput): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in to save your profile.');
    await setDoc(
      doc(this.firestore, 'users', uid),
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

  private mergeFromFirestore(user: User, raw?: Record<string, unknown>): UserProfile {
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
}
