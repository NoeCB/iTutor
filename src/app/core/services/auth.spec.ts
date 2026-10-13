import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

/**
 * Pruebas unitarias del servicio de autenticación (RA 1).
 *
 * Cubren el control de acceso real del sistema: estado inicial anónimo,
 * verificación de credenciales contra hash y resistencia a la manipulación
 * del almacenamiento local del navegador.
 */
describe('AuthService', () => {
  /**
   * El servicio lee `localStorage` en su constructor, por lo que cada prueba
   * debe limpiar el almacenamiento ANTES de solicitar la instancia.
   */
  function crearServicio(): AuthService {
    TestBed.configureTestingModule({});
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('debe crearse correctamente', () => {
    expect(crearServicio()).toBeTruthy();
  });

  describe('Estado inicial de sesión (prevención de acceso no autorizado)', () => {
    it('NO debe iniciar sesión automáticamente cuando no hay datos almacenados', () => {
      const service = crearServicio();

      // Regresión crítica: si el servicio arrancase con un usuario por defecto,
      // el authGuard podría eludirse navegando directamente por URL.
      expect(service.currentUserValue).toBeNull();
    });

    it('debe exponer el estado anónimo también en el flujo observable', () => {
      const service = crearServicio();
      let emitido: unknown = 'sin-emitir';

      service.currentUser$.subscribe(user => (emitido = user));

      expect(emitido).toBeNull();
    });
  });

  describe('authenticate()', () => {
    it('debe autenticar al administrador con credenciales válidas', () => {
      const service = crearServicio();

      const user = service.authenticate('noeliacantador@itutor.es', 'noelia');

      expect(user).not.toBeNull();
      expect(user?.role).toBe('Admin');
      expect(service.currentUserValue?.email).toBe('noeliacantador@itutor.es');
    });

    it('debe autenticar a la alumna con el rol Standard', () => {
      const service = crearServicio();

      const user = service.authenticate('paulagarcia@itutor.es', 'paula');

      expect(user?.role).toBe('Standard');
    });

    it('debe autenticar a un profesor con el rol Teacher', () => {
      const service = crearServicio();

      const user = service.authenticate('elena.ramos@itutor.es', 'elena');

      expect(user?.role).toBe('Teacher');
    });

    it('debe normalizar mayúsculas y espacios en el correo', () => {
      const service = crearServicio();

      const user = service.authenticate('  NoeliaCantador@ITUTOR.es  ', 'noelia');

      expect(user).not.toBeNull();
      expect(user?.email).toBe('noeliacantador@itutor.es');
    });

    it('debe rechazar una contraseña incorrecta y dejar la sesión cerrada', () => {
      const service = crearServicio();

      const user = service.authenticate('noeliacantador@itutor.es', 'contrasena-erronea');

      expect(user).toBeNull();
      expect(service.currentUserValue).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('debe rechazar un correo que no existe en el sistema', () => {
      const service = crearServicio();

      const user = service.authenticate('intruso@otrodominio.com', 'cualquiera');

      expect(user).toBeNull();
      expect(service.currentUserValue).toBeNull();
    });

    it('debe persistir usuario y token tras un login correcto', () => {
      const service = crearServicio();

      service.authenticate('paulagarcia@itutor.es', 'paula');

      expect(localStorage.getItem('user')).not.toBeNull();
      expect(localStorage.getItem('token')).not.toBeNull();
    });
  });

  describe('logout()', () => {
    it('debe limpiar el estado y las credenciales almacenadas', () => {
      const service = crearServicio();
      service.authenticate('noeliacantador@itutor.es', 'noelia');

      service.logout();

      expect(service.currentUserValue).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('Rehidratación de sesión desde localStorage', () => {
    it('debe restaurar una sesión válida previamente guardada', () => {
      localStorage.setItem(
        'user',
        JSON.stringify({ email: 'paulagarcia@itutor.es', name: 'Paula García', role: 'Standard' })
      );
      localStorage.setItem('token', 'token-simulado');

      const service = crearServicio();

      expect(service.currentUserValue?.email).toBe('paulagarcia@itutor.es');
      expect(service.currentUserValue?.role).toBe('Standard');
    });

    it('debe impedir la escalada de privilegios si se manipula el rol', () => {
      // Un atacante edita localStorage para auto-asignarse el rol Admin.
      localStorage.setItem(
        'user',
        JSON.stringify({ email: 'paulagarcia@itutor.es', name: 'Paula García', role: 'Admin' })
      );
      localStorage.setItem('token', 'token-simulado');

      const service = crearServicio();

      // El rol persistido no coincide con el real: se cierra la sesión.
      expect(service.currentUserValue).toBeNull();
    });

    it('debe descartar una sesión de un correo inexistente', () => {
      localStorage.setItem(
        'user',
        JSON.stringify({ email: 'fantasma@itutor.es', role: 'Admin' })
      );
      localStorage.setItem('token', 'token-simulado');

      const service = crearServicio();

      expect(service.currentUserValue).toBeNull();
    });

    it('debe descartar un JSON corrupto sin lanzar excepciones', () => {
      localStorage.setItem('user', '{{{no-es-json');
      localStorage.setItem('token', 'token-simulado');

      expect(() => crearServicio()).not.toThrow();
      expect(TestBed.inject(AuthService).currentUserValue).toBeNull();
    });

    it('debe exigir token además de usuario para restaurar la sesión', () => {
      localStorage.setItem(
        'user',
        JSON.stringify({ email: 'paulagarcia@itutor.es', role: 'Standard' })
      );
      // Sin token almacenado.

      const service = crearServicio();

      expect(service.currentUserValue).toBeNull();
    });
  });

  describe('checkEmailExists() (validación asíncrona del formulario)', () => {
    it('debe emitir true para un correo registrado', async () => {
      const service = crearServicio();

      const existe = await new Promise<boolean>(resolve =>
        service.checkEmailExists('paulagarcia@itutor.es').subscribe(resolve)
      );

      expect(existe).toBe(true);
    });

    it('debe emitir false para un correo no registrado', async () => {
      const service = crearServicio();

      const existe = await new Promise<boolean>(resolve =>
        service.checkEmailExists('desconocido@itutor.es').subscribe(resolve)
      );

      expect(existe).toBe(false);
    });
  });
});
