import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot
} from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService, User } from '../services/auth.service';

/**
 * Pruebas unitarias del guard de control de acceso por roles (RA 1).
 *
 * Se sustituye `AuthService` y `Router` por dobles de prueba para poder
 * verificar de forma aislada las dos capas del guard: autenticación y
 * autorización por rol.
 */
describe('authGuard', () => {
  /** Representación mínima de un `UrlTree` devuelto por el doble del router. */
  interface UrlTreeDoble {
    comandos: unknown[];
    extras?: unknown;
  }

  /** Doble de prueba del router: registra los `UrlTree` de redirección creados. */
  class RouterDoble {
    redirecciones: UrlTreeDoble[] = [];
    createUrlTree(comandos: unknown[], extras?: unknown): UrlTreeDoble {
      const arbol = { comandos, extras };
      this.redirecciones.push(arbol);
      return arbol;
    }
    get ultimaRuta(): string {
      const ultima = this.redirecciones[this.redirecciones.length - 1];
      return ultima ? String((ultima.comandos as string[])[0]) : '';
    }
  }

  /** Doble de prueba del servicio de autenticación. */
  class AuthServiceDoble {
    currentUserValue: User | null = null;
  }

  let router: RouterDoble;
  let auth: AuthServiceDoble;

  beforeEach(() => {
    router = new RouterDoble();
    auth = new AuthServiceDoble();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: auth }
      ]
    });
  });

  /** Ejecuta el guard con la configuración de ruta y URL indicadas. */
  function ejecutarGuard(data: Record<string, unknown>, url = '/ruta-protegida'): unknown {
    const route = { data } as unknown as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => authGuard(route, state));
  }

  describe('Capa 1: autenticación', () => {
    it('debe denegar el acceso si no hay sesión activa', () => {
      auth.currentUserValue = null;

      const resultado = ejecutarGuard({ role: 'Admin' });

      expect(resultado).not.toBe(true);
    });

    it('debe redirigir a /login con la URL limpia (sin returnUrl)', () => {
      auth.currentUserValue = null;

      const resultado = ejecutarGuard({ role: 'Admin' }, '/admin-dashboard');

      expect(resultado).toBe(router.redirecciones[0]);
      expect(router.ultimaRuta).toBe('/login');
      expect(router.redirecciones[0].extras).toBeUndefined();
    });

    it('debe redirigir a /login desde cualquier ruta protegida', () => {
      auth.currentUserValue = null;

      for (const url of ['/mis-clases', '/mis-apuntes', '/mensajes-profesores', '/mis-pagos', '/ajustes', '/portal-profesor']) {
        ejecutarGuard({ role: ['Standard', 'Teacher', 'Admin'] }, url);
        expect(router.ultimaRuta).toBe('/login');
      }
      expect(router.redirecciones.every(r => r.extras === undefined)).toBe(true);
    });
  });

  describe('Capa 2: autorización por rol', () => {
    it('debe permitir el acceso cuando el rol coincide exactamente', () => {
      auth.currentUserValue = { email: 'paulagarcia@itutor.es', role: 'Standard' };

      expect(ejecutarGuard({ role: 'Standard' })).toBe(true);
    });

    it('debe permitir el acceso cuando el rol está en la lista permitida', () => {
      auth.currentUserValue = { email: 'elenaramos@itutor.es', role: 'Teacher' };

      expect(ejecutarGuard({ role: ['Standard', 'Teacher'] })).toBe(true);
    });

    it('debe denegar el acceso de una alumna a una ruta exclusiva de profesor', () => {
      auth.currentUserValue = { email: 'paulagarcia@itutor.es', role: 'Standard' };

      const resultado = ejecutarGuard({ role: 'Teacher' });

      expect(resultado).not.toBe(true);
    });

    it('debe redirigir al usuario denegado a la vista inicial de su rol', () => {
      auth.currentUserValue = { email: 'paulagarcia@itutor.es', role: 'Standard' };

      ejecutarGuard({ role: 'Teacher' });

      expect(router.ultimaRuta).toBe('/mis-clases');
    });

    it('debe redirigir al profesor denegado a su portal docente', () => {
      auth.currentUserValue = { email: 'elenaramos@itutor.es', role: 'Teacher' };

      ejecutarGuard({ role: 'Standard' });

      expect(router.ultimaRuta).toBe('/portal-profesor');
    });

    it('debe permitir el paso a cualquier usuario autenticado si la ruta no exige rol', () => {
      auth.currentUserValue = { email: 'paulagarcia@itutor.es', role: 'Standard' };

      expect(ejecutarGuard({})).toBe(true);
    });
  });

  describe('Política documentada de superusuario (Admin)', () => {
    it('debe permitir al administrador supervisar rutas de alumno', () => {
      auth.currentUserValue = { email: 'noeliacantador@itutor.es', role: 'Admin' };

      expect(ejecutarGuard({ role: 'Standard' })).toBe(true);
    });

    it('debe permitir al administrador supervisar rutas de profesor', () => {
      auth.currentUserValue = { email: 'noeliacantador@itutor.es', role: 'Admin' };

      expect(ejecutarGuard({ role: ['Teacher'] })).toBe(true);
    });
  });
});
