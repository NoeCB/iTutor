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
  /** Doble de prueba del router: registra las navegaciones solicitadas. */
  class RouterDoble {
    navegaciones: { comandos: unknown[]; extras?: unknown }[] = [];
    navigate(comandos: unknown[], extras?: unknown): Promise<boolean> {
      this.navegaciones.push({ comandos, extras });
      return Promise.resolve(true);
    }
    get ultimaRuta(): string {
      const ultima = this.navegaciones[this.navegaciones.length - 1];
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
  function ejecutarGuard(data: Record<string, unknown>, url = '/ruta-protegida'): boolean {
    const route = { data } as unknown as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(
      () => authGuard(route, state) as boolean
    );
  }

  describe('Capa 1: autenticación', () => {
    it('debe denegar el acceso si no hay sesión activa', () => {
      auth.currentUserValue = null;

      const permitido = ejecutarGuard({ role: 'Admin' });

      expect(permitido).toBe(false);
    });

    it('debe redirigir al login conservando la URL solicitada', () => {
      auth.currentUserValue = null;

      ejecutarGuard({ role: 'Admin' }, '/admin-dashboard');

      expect(router.ultimaRuta).toBe('/login');
      expect(router.navegaciones[0].extras).toEqual({
        queryParams: { returnUrl: '/admin-dashboard' }
      });
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

      const permitido = ejecutarGuard({ role: 'Teacher' });

      expect(permitido).toBe(false);
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
