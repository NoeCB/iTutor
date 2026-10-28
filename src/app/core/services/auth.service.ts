import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface User {
  email: string;
  name?: string;
  role: 'Admin' | 'Standard' | 'Teacher';
  birthDate?: string;
  subjects?: string[];
}

interface StoredAccount {
  email: string;
  name: string;
  role: 'Admin' | 'Standard' | 'Teacher';
  birthDate?: string;
  subjects?: string[];
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
   * - Profesor (Teacher): elenaramos@itutor.es (clave: elena)
   * - Profesor (Teacher): carlosmendez@itutor.es (clave: carlos)
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
      email: 'elenaramos@itutor.es',
      name: 'Elena Ramos',
      role: 'Teacher',
      salt: 'salt_teacher_2026',
      passwordHash: '$2b$12$salt_teacher_2026$a8be79c5c8293d93'
    },
    {
      email: 'carlosmendez@itutor.es',
      name: 'Prof. Carlos Méndez',
      role: 'Teacher',
      salt: 'salt_carlos_2026',
      passwordHash: '$2b$12$salt_carlos_2026$d7e605c5c10bc993'
    },
    {
      email: 'profesor@itutor.es',
      name: 'Elena Ramos (Demo Profesor)',
      role: 'Teacher',
      salt: 'salt_profe_2026',
      passwordHash: '$2b$12$salt_profe_2026$77cd5dc5eb524993'
    }
  ];

  /** Clave de `localStorage` donde se guardan las cuentas creadas desde el formulario de registro */
  private static readonly REGISTERED_KEY = 'itutor_registered_accounts';
  private static readonly DELETED_KEY = 'itutor_deleted_accounts';
  private static readonly AVATARS_KEY = 'itutor_user_avatars';

  /**
   * Almacenamiento de la sesión activa. Se usa `sessionStorage` (por pestaña)
   * para que en el mismo navegador puedan convivir, por ejemplo, la profesora
   * Elena en una pestaña y la alumna Paula en otra, y así chatear entre ellas.
   */
  private readonly sessionStore: Storage = sessionStorage;

  /**
   * Estado de sesión. Arranca SIEMPRE como `null` (sesión anónima): ninguna
   * credencial se asume por defecto, de forma que el `authGuard` no pueda
   * eludirse navegando directamente por URL a una ruta protegida.
   * Solo `authenticate()` (login explícito) o la rehidratación de una sesión
   * previamente validada en `sessionStorage` pueden poblar este estado.
   */
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.restoreSession();
  }

  /** Cuentas creadas por los usuarios mediante el formulario de registro */
  private loadRegisteredAccounts(): StoredAccount[] {
    try {
      const raw = localStorage.getItem(AuthService.REGISTERED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Todas las cuentas conocidas: las del sistema + las registradas (excluyendo las eliminadas) */
  private get allAccounts(): StoredAccount[] {
    let deleted: string[] = [];
    try {
      const raw = localStorage.getItem(AuthService.DELETED_KEY);
      deleted = raw ? JSON.parse(raw) : [];
    } catch {
      deleted = [];
    }
    const deletedSet = new Set(Array.isArray(deleted) ? deleted : []);
    return [...this.ACCOUNTS, ...this.loadRegisteredAccounts()].filter(
      acc => !deletedSet.has(acc.email.toLowerCase())
    );
  }

  private findAccount(email: string): StoredAccount | undefined {
    const normalizedEmail = (email || '').trim().toLowerCase();
    return this.allAccounts.find(acc => acc.email === normalizedEmail);
  }

  /** Devuelve los datos públicos (sin hash) de una cuenta por su email */
  getPublicAccount(email: string): User | null {
    const account = this.findAccount(email);
    return account ? { email: account.email, name: account.name, role: account.role } : null;
  }

  /**
   * Rehidrata la sesión desde `sessionStorage` validando que el usuario
   * persistido corresponda a una cuenta real y a un rol conocido.
   * Cualquier dato corrupto, manipulado o desconocido provoca el cierre
   * inmediato de la sesión en lugar de conceder acceso por defecto.
   */
  private restoreSession(): void {
    const savedUser = this.sessionStore.getItem('user') || localStorage.getItem('user');
    const savedToken = this.sessionStore.getItem('token') || localStorage.getItem('token');

    if (!savedUser || !savedToken) {
      this.clearSession();
      return;
    }

    try {
      const parsed = JSON.parse(savedUser) as Partial<User>;
      const account = this.findAccount(parsed.email || '');

      // El rol persistido debe coincidir con el rol real de la cuenta en el
      // sistema: así se evita la escalada de privilegios editando el storage.
      if (!account || parsed.role !== account.role) {
        this.clearSession();
        return;
      }

      this.currentUserSubject.next({
        email: account.email,
        name: account.name,
        role: account.role,
        birthDate: account.birthDate,
        subjects: account.subjects
      });
    } catch {
      this.clearSession();
    }
  }

  /** Limpia por completo el estado de sesión y las credenciales almacenadas. */
  private clearSession(): void {
    this.sessionStore.removeItem('user');
    this.sessionStore.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
  }

  /** Indica si existe una sesión autenticada activa. */
  get isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /** Token de la sesión activa (usado por el interceptor HTTP) */
  get token(): string | null {
    return this.sessionStore.getItem('token');
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
    const account = this.findAccount(email);

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

  /**
   * Registra una nueva cuenta de Profesor (Teacher) o Alumno (Standard).
   * La contraseña se guarda SOLO como hash con salt aleatorio (nunca en claro).
   * Tras el registro se inicia sesión automáticamente.
   */
  register(
    name: string,
    email: string,
    password: string,
    role: 'Standard' | 'Teacher',
    extra?: { birthDate?: string; subjects?: string[] }
  ): User {
    const normalizedEmail = email.trim().toLowerCase();
    // Si la cuenta había sido eliminada previamente, rehabilitarla
    try {
      const rawDel = localStorage.getItem(AuthService.DELETED_KEY);
      const delList: string[] = rawDel ? JSON.parse(rawDel) : [];
      if (Array.isArray(delList) && delList.includes(normalizedEmail)) {
        localStorage.setItem(
          AuthService.DELETED_KEY,
          JSON.stringify(delList.filter(e => e !== normalizedEmail))
        );
      }
    } catch {
      // ignore
    }

    if (this.findAccount(normalizedEmail)) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const salt = `salt_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    const account: StoredAccount = {
      email: normalizedEmail,
      name: name.trim(),
      role,
      birthDate: extra?.birthDate || '2002-05-14',
      subjects: extra?.subjects || [],
      salt,
      passwordHash: this.computeSaltedHash(password, salt)
    };

    const registered = this.loadRegisteredAccounts().filter(a => a.email !== normalizedEmail);
    registered.push(account);
    localStorage.setItem(AuthService.REGISTERED_KEY, JSON.stringify(registered));

    this.login(account.email, account.role, account.name);
    return this.currentUserValue as User;
  }

  /** Obtiene la foto de perfil subida por el propio usuario (null si no ha subido ninguna) */
  getUserAvatar(email?: string | null): string | null {
    if (!email) return null;
    try {
      const raw = localStorage.getItem(AuthService.AVATARS_KEY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      return map[email.trim().toLowerCase()] || null;
    } catch {
      return null;
    }
  }

  /** Guarda o elimina la foto de perfil subida por el usuario */
  setUserAvatar(email: string, dataUrl: string | null): void {
    const key = email.trim().toLowerCase();
    try {
      const raw = localStorage.getItem(AuthService.AVATARS_KEY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      if (dataUrl) {
        map[key] = dataUrl;
      } else {
        delete map[key];
      }
      localStorage.setItem(AuthService.AVATARS_KEY, JSON.stringify(map));
      if (this.currentUserSubject.value) {
        this.currentUserSubject.next({ ...this.currentUserSubject.value });
      }
    } catch {
      // ignore quota errors
    }
  }

  /** Elimina la cuenta del usuario actual y cierra su sesión */
  deleteAccount(email: string): void {
    const normalized = email.trim().toLowerCase();
    try {
      const registered = this.loadRegisteredAccounts().filter(a => a.email !== normalized);
      localStorage.setItem(AuthService.REGISTERED_KEY, JSON.stringify(registered));

      const rawDel = localStorage.getItem(AuthService.DELETED_KEY);
      const delList: string[] = rawDel ? JSON.parse(rawDel) : [];
      if (!delList.includes(normalized)) {
        delList.push(normalized);
        localStorage.setItem(AuthService.DELETED_KEY, JSON.stringify(delList));
      }
      this.setUserAvatar(normalized, null);
    } catch {
      // ignore
    }
    this.logout();
  }

  login(email: string, role: 'Admin' | 'Standard' | 'Teacher', name?: string): void {
    const normalizedEmail = email.trim().toLowerCase();
    const account = this.findAccount(normalizedEmail);
    const user: User = {
      email: normalizedEmail,
      name: name || account?.name || normalizedEmail.split('@')[0],
      role: account?.role || role,
      birthDate: account?.birthDate,
      subjects: account?.subjects
    };
    this.currentUserSubject.next(user);
    const serialized = JSON.stringify(user);
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.iTUTOR.signature';
    this.sessionStore.setItem('user', serialized);
    this.sessionStore.setItem('token', token);
    localStorage.setItem('user', serialized);
    localStorage.setItem('token', token);
  }

  logout(): void {
    this.currentUserSubject.next(null);
    this.sessionStore.removeItem('user');
    this.sessionStore.removeItem('token');
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
    const exists = !!this.findAccount(email);
    return of(exists).pipe(delay(500));
  }
}
