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
    path: 'login',
    loadComponent: () => import('./features/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'mis-clases',
    loadComponent: () => import('./features/mis-clases/mis-clases.page').then(m => m.MisClasesPage),
    canActivate: [authGuard],
    data: { role: 'Standard', section: 'tutorias' }
  },
  {
    path: 'mis-apuntes',
    loadComponent: () => import('./features/mis-clases/mis-clases.page').then(m => m.MisClasesPage),
    canActivate: [authGuard],
    data: { role: 'Standard', section: 'apuntes' }
  },
  {
    path: 'mensajes-profesores',
    loadComponent: () => import('./features/mis-clases/mis-clases.page').then(m => m.MisClasesPage),
    canActivate: [authGuard],
    data: { role: 'Standard', section: 'mensajes' }
  },
  {
    path: 'mis-pagos',
    loadComponent: () => import('./features/mis-clases/mis-clases.page').then(m => m.MisClasesPage),
    canActivate: [authGuard],
    data: { role: 'Standard', section: 'pagos' }
  },
  {
    path: 'ajustes',
    loadComponent: () => import('./features/mis-clases/mis-clases.page').then(m => m.MisClasesPage),
    canActivate: [authGuard],
    data: { section: 'ajustes' }
  }
];