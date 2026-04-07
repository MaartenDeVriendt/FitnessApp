import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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

  protected readonly user = this.authService.user;
  private readonly profile = toSignal(this.profileService.profile$, { initialValue: null });

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

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login');
  }
}
