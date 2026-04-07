import { Component, computed, DestroyRef, effect, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { merge, of } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { ProfileService } from './services/profile.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly user = this.authService.user;
  private readonly profile = toSignal(this.profileService.profile$, { initialValue: null });

  /** Mobile slide-out menu */
  protected readonly menuOpen = signal(false);

  private readonly currentPath = toSignal(
    merge(
      of(this.router.url),
      this.router.events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map(() => this.router.url),
      ),
    ).pipe(map((url) => url.split('?')[0] ?? '/')),
    { initialValue: (this.router.url.split('?')[0] ?? '/') as string },
  );

  /** Label for the active main tab (drawer hint + clarity). */
  protected readonly currentRouteLabel = computed(() => {
    const path = this.currentPath() ?? '/';
    if (path === '/week' || path === '/') return 'Today';
    if (path.startsWith('/program')) return 'Week template';
    if (path.startsWith('/prs')) return 'PRs';
    if (path.startsWith('/profile')) return 'Profile';
    return null;
  });

  /** Header title: nickname → display name → email local-part → fallback. */
  protected readonly brandLabel = computed(() => {
    const u = this.user();
    const p = this.profile();
    if (!u) return 'Train';
    const nick = p?.nickname?.trim();
    if (nick) return nick;
    const dn = (p?.displayName ?? u.displayName)?.trim();
    if (dn) return dn;
    const local = u.email?.split('@')[0]?.trim();
    if (local) return local;
    return 'Train';
  });

  constructor() {
    effect(() => {
      const open = this.menuOpen();
      if (typeof document === 'undefined') return;
      document.body.style.overflow = open ? 'hidden' : '';
    });

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(min-width: 42.01rem)');
      const onWide = (e: MediaQueryListEvent): void => {
        if (e.matches) this.closeMenu();
      };
      mq.addEventListener('change', onWide);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', onWide));
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.closeMenu();
  }

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  async logout(): Promise<void> {
    this.closeMenu();
    await this.authService.logout();
    await this.router.navigateByUrl('/login');
  }
}
