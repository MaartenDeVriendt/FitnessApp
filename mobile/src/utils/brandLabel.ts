import type { User } from 'firebase/auth';
import type { UserProfile } from '../domain/fitness.models';

export function brandLabel(user: User | null, profile: UserProfile | null): string {
  if (!user) return 'Train';
  const nick = profile?.nickname?.trim();
  if (nick) return nick;
  const dn = (profile?.displayName ?? user.displayName)?.trim();
  if (dn) return dn;
  const local = user.email?.split('@')[0]?.trim();
  if (local) return local;
  return 'Train';
}
