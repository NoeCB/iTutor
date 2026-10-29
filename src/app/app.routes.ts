import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'admin-dashboard',
    loadComponent: () => import('./features/admin-dashboard/admin-dashboard.page').then(m => m.AdminDashboardPage),
    canActivate: [authGuard],
    data: { role: 'Admin' }
  },
  {
    path: 'portal-profesor',
    loadComponent: () => import('./features/profesor-dashboard/profesor-dashboard.page').then(m => m.ProfesorDashboardPage),
    canActivate: [authGuard],
    data: { role: ['Teacher', 'Admin'] }
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'mis-clases',
    loadComponent: () => import('./features/mis-clases/mis-clases.page').then(m => m.MisClasesPage),
    canActivate: [authGuard],
    data: { role: ['Standard', 'Teacher', 'Admin'], section: 'tutorias' }
  },
  {
    path: 'mis-apuntes',
    loadComponent: () => import('./features/mis-clases/mis-clases.page').then(m => m.MisClasesPage),
    canActivate: [authGuard],
    data: { role: ['Standard', 'Teacher', 'Admin'], section: 'apuntes' }
  },
  {
    path: 'mensajes-profesores',
    loadComponent: () => import('./features/mis-clases/mis-clases.page').then(m => m.MisClasesPage),
    canActivate: [authGuard],
    data: { role: ['Standard', 'Teacher', 'Admin'], section: 'mensajes' }
  },
  {
    path: 'mis-pagos',
    loadComponent: () => import('./features/mis-clases/mis-clases.page').then(m => m.MisClasesPage),
    canActivate: [authGuard],
    data: { role: ['Standard', 'Admin'], section: 'pagos' }
  },
  {
    path: 'ajustes',
    loadComponent: () => import('./features/mis-clases/mis-clases.page').then(m => m.MisClasesPage),
    canActivate: [authGuard],
    data: { role: ['Standard', 'Teacher', 'Admin'], section: 'ajustes' }
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
