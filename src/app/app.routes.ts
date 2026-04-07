import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './guards/auth.guard';
import { LoginComponent } from './login/login.component';
import { PrSummaryComponent } from './pr-summary/pr-summary.component';
import { ProgramEditorComponent } from './program-editor/program-editor.component';
import { ProfileComponent } from './profile/profile.component';
import { WeekViewComponent } from './week-view/week-view.component';

export const routes: Routes = [
  /** Logged-out users land here; `loginGuard` sends signed-in users to `/week`. */
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent, canActivate: [loginGuard] },
  { path: 'week', component: WeekViewComponent, canActivate: [authGuard] },
  { path: 'program', component: ProgramEditorComponent, canActivate: [authGuard] },
  { path: 'prs', component: PrSummaryComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  /** Unknown URLs: login if signed out; `loginGuard` bounces signed-in users to `/week`. */
  { path: '**', redirectTo: 'login' },
];
