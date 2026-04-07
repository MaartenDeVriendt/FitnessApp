import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, authState, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from '@angular/fire/auth';
import { doc, Firestore, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { User } from 'firebase/auth';
import { Observable } from 'rxjs';

/**
 * Email/password auth and optional `users/{uid}` profile document.
 * Firebase Auth is the source of truth for UIDs; Firestore stores app-specific profile fields.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  /** Emits the current user or `null` when signed out. */
  readonly user$: Observable<User | null> = authState(this.auth);

  /** Signal wrapper for templates (initial `null` before first auth event). */
  readonly user = toSignal(this.user$, { initialValue: null });

  async signUp(email: string, password: string, displayName?: string): Promise<void> {
    const cred = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
    const uid = cred.user.uid;
    await setDoc(
      doc(this.firestore, 'users', uid),
      {
        uid,
        email: cred.user.email,
        displayName: displayName?.trim() || null,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email.trim(), password);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
