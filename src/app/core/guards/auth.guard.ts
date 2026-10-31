import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard funcional de control de acceso (RA 1).
 *
 * Aplica dos niveles de comprobación antes de permitir la activación de una ruta:
 *
 * 1. **Autenticación:** debe existir una sesión activa. Como `AuthService`
 *    arranca con estado `null`, navegar directamente por URL a una ruta
 *    protegida sin haber iniciado sesión redirige siempre a `/login`.
 *
 * 2. **Autorización por rol:** si la ruta declara `data.role` (un rol o un
 *    array de roles), el rol del usuario debe estar entre los permitidos.
 *
 * POLÍTICA DE PRIVILEGIOS DOCUMENTADA: el rol `Admin` se considera
 * *superusuario* del sistema y tiene acceso de supervisión a todas las rutas,
 * incluidas las de alumno y profesor. Esto es una decisión de diseño
 * deliberada (el administrador de la academia necesita auditar los portales
 * de alumnos y docentes), no un descuido en la comprobación de roles.
 * Las rutas sin `data.role` quedan accesibles para cualquier usuario
 * autenticado (por ejemplo, `/ajustes`).
 *
 * Las redirecciones se devuelven como `UrlTree` (en lugar de llamar a
 * `router.navigate()` y devolver `false`) para que Angular sustituya la
 * navegación en curso de forma atómica. Al redirigir al login se usa siempre
 * la URL limpia `/login` (sin `?returnUrl=...`): así la barra de direcciones
 * no muestra parámetros extraños y el layout nunca confunde la pantalla de
 * login con una vista interna (lo que provocaba que apareciera el menú
 * lateral del administrador sin haber iniciado sesión).
 */
export const authGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUserValue;

  // --- Nivel 1: ¿hay sesión activa? ---
  if (!user) {
    return router.createUrlTree(['/login']);
  }

  // --- Nivel 2: ¿el rol está autorizado para esta ruta? ---
  const expectedRole = route.data?.['role'] as string | string[] | undefined;

  // Ruta protegida solo por autenticación, sin restricción de rol.
  if (!expectedRole) {
    return true;
  }

  // El administrador actúa como superusuario de supervisión (ver nota arriba).
  if (user.role === 'Admin') {
    return true;
  }

  const allowedRoles = Array.isArray(expectedRole) ? expectedRole : [expectedRole];

  if (!allowedRoles.includes(user.role)) {
    // Acceso denegado: se devuelve al usuario a la vista inicial de su rol
    // en lugar de dejarlo en una pantalla sin permisos.
    return router.createUrlTree([getHomeRouteForRole(user.role)]);
  }

  return true;
};

/** Ruta de inicio por defecto correspondiente a cada rol del sistema. */
function getHomeRouteForRole(role: 'Admin' | 'Standard' | 'Teacher'): string {
  switch (role) {
    case 'Admin':
      return '/admin-dashboard';
    case 'Teacher':
      return '/portal-profesor';
    default:
      return '/mis-clases';
  }
}
