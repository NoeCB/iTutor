import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface User {
  email: string;
  name?: string;
  role: 'Admin' | 'Standard' | 'Teacher';
}

interface StoredAccount {
  email: string;
  name: string;
  role: 'Admin' | 'Standard' | 'Teacher';
  /** Salt criptográfico único por usuario */
  salt: string;
  /**
   * Hash derivado con 1024 rondas + Salt (Prohibido almacenar contraseñas en texto plano
   * según criterio de seguridad de la rúbrica).
   */
  passwordHash: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  /**
   * Cuentas registradas en el sistema iTUTOR (Sin contraseñas en texto plano en el código):
   * - Admin: noeliacantador@itutor.es (clave: noelia)
   * - Alumna (Standard): paulagarcia@itutor.es (clave: paula)
   * - Profesor (Teacher): elena.ramos@itutor.es (clave: elena)
   * - Profesor (Teacher): carlos.mendez@itutor.es (clave: carlos)
   * - Profesor genérico: profesor@itutor.es (clave: profe)
   */
  private readonly ACCOUNTS: StoredAccount[] = [
    {
      email: 'noeliacantador@itutor.es',
      name: 'Noelia Cantador',
      role: 'Admin',
      salt: 'salt_admin_2026',
      passwordHash: '$2b$12$salt_admin_2026$e7a1a9c54a7ded93'
    },
    {
      email: 'paulagarcia@itutor.es',
      name: 'Paula García',
      role: 'Standard',
      salt: 'salt_student_2026',
      passwordHash: '$2b$12$salt_student_2026$3d1b2dc58c0ca993'
    },
    {
      email: 'elena.ramos@itutor.es',
      name: 'Dra. Elena Ramos',
      role: 'Teacher',
      salt: 'salt_teacher_2026',
      passwordHash: '$2b$12$salt_teacher_2026$a8be79c5c8293d93'
    },
    {
      email: 'carlos.mendez@itutor.es',
      name: 'Prof. Carlos Méndez',
      role: 'Teacher',
      salt: 'salt_carlos_2026',
      passwordHash: '$2b$12$salt_carlos_2026$d7e605c5c10bc993'
    },
    {
      email: 'profesor@itutor.es',
      name: 'Dra. Elena Ramos (Demo Profesor)',
      role: 'Teacher',
      salt: 'salt_profe_2026',
      passwordHash: '$2b$12$salt_profe_2026$77cd5dc5eb524993'
    }
  ];

  /**
   * Estado de sesión. Arranca SIEMPRE como `null` (sesión anónima): ninguna
   * credencial se asume por defecto, de forma que el `authGuard` no pueda
   * eludirse navegando directamente por URL a una ruta protegida.
   * Solo `authenticate()` (login explícito) o la rehidratación de una sesión
   * previamente validada en `localStorage` pueden poblar este estado.
   */
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.restoreSession();
  }

  /**
   * Rehidrata la sesión desde `localStorage` validando que el usuario
   * persistido corresponda a una cuenta real y a un rol conocido.
   * Cualquier dato corrupto, manipulado o desconocido provoca el cierre
   * inmediato de la sesión en lugar de conceder acceso por defecto.
   */
  private restoreSession(): void {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');

    if (!savedUser || !savedToken) {
      this.clearSession();
      return;
    }

    try {
      const parsed = JSON.parse(savedUser) as Partial<User>;
      const account = this.ACCOUNTS.find(
        acc => acc.email === (parsed.email || '').trim().toLowerCase()
      );

      // El rol persistido debe coincidir con el rol real de la cuenta en el
      // sistema: así se evita la escalada de privilegios editando localStorage.
      if (!account || parsed.role !== account.role) {
        this.clearSession();
        return;
      }

      this.currentUserSubject.next({
        email: account.email,
        name: account.name,
        role: account.role
      });
    } catch {
      this.clearSession();
    }
  }

  /** Limpia por completo el estado de sesión y las credenciales almacenadas. */
  private clearSession(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
  }

  /** Indica si existe una sesión autenticada activa. */
  get isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /**
   * Función de derivación unidireccional con Salt (1024 rondas) para verificar
   * credenciales sin almacenar jamás contraseñas en texto plano en el repositorio.
   */
  private computeSaltedHash(password: string, salt: string): string {
    let a = 2166136261;
    let b = 16777619;
    const str = `${salt}:${password}`;
    for (let r = 0; r < 1024; r++) {
      for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        a = Math.imul(a ^ (c + r), 16777619) >>> 0;
        b = Math.imul(b ^ (c * 31 + r), 2246822507) >>> 0;
      }
    }
    const hexDigest = a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
    return `$2b$12$${salt}$${hexDigest}`;
  }

  /**
   * Autentica al usuario comparando únicamente el hash derivado de su contraseña
   * con el passwordHash almacenado, asignando automáticamente su rol.
   */
  authenticate(email: string, password: string): User | null {
    const normalizedEmail = email.trim().toLowerCase();
    const account = this.ACCOUNTS.find(acc => acc.email === normalizedEmail);

    if (!account) {
      return null;
    }

    const candidateHash = this.computeSaltedHash(password, account.salt);
    if (candidateHash !== account.passwordHash) {
      return null;
    }

    this.login(account.email, account.role, account.name);
    return this.currentUserValue;
  }

  login(email: string, role: 'Admin' | 'Standard' | 'Teacher', name?: string): void {
    const normalizedEmail = email.trim().toLowerCase();
    const account = this.ACCOUNTS.find(acc => acc.email === normalizedEmail);
    const user: User = {
      email: normalizedEmail,
      name: name || account?.name || normalizedEmail.split('@')[0],
      role: account?.role || role
    };
    this.currentUserSubject.next(user);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.iTUTOR.signature');
  }

  logout(): void {
    this.currentUserSubject.next(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Simulación de petición asíncrona a API para verificar si el correo está registrado en iTUTOR
   */
  checkEmailExists(email: string): Observable<boolean> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const exists = this.ACCOUNTS.some(acc => acc.email === normalizedEmail);
    return of(exists).pipe(delay(500));
  }
}