import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map, take } from 'rxjs/operators';

/** Allow route only when signed in; otherwise navigate to `/login`. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return authState(auth).pipe(
    take(1),
    map((u) => (u ? true : router.createUrlTree(['/login']))),
  );
};

/** Allow `/login` only when signed out; signed-in users go to `/workouts`. */
export const loginGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return authState(auth).pipe(
    take(1),
    map((u) => (!u ? true : router.createUrlTree(['/week']))),
  );
};
