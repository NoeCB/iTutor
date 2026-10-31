import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSyncService } from './api-sync.service';
import { AuthService } from './auth.service';

/** Clase agendada por un profesor para uno de sus alumnos asignados */
export interface ScheduledClass {
  id: string;
  teacherEmail: string;
  teacherName: string;
  studentEmail: string;
  studentName: string;
  subject: string;
  topic: string;
  /** Fecha y hora local de inicio en formato `YYYY-MM-DDTHH:mm` */
  start: string;
  durationMin: number;
  price: number;
  notes: string;
  createdAt: number;
  /** Departamento (Física / Matemáticas / Química) para las estadísticas de administración */
  branch?: string;
}

/** Fila de `/api/sessions` tal y como la devuelve el servidor */
interface SessionRow {
  _id: string;
  studentEmail?: string;
  teacherEmail?: string;
  estudianteNombre?: string;
  tutor?: string;
  materia?: string;
  rama?: string;
  topic?: string;
  startAt?: string;
  duracionMin?: number;
  importe?: number;
  notasSeguimiento?: string;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Servicio de agenda de clases de iTUTOR.
 *
 * Las clases se guardan en el servidor (SQLite en AWS) para que alumno y profesor
 * las vean desde cualquier dispositivo, y se conserva una copia en `localStorage`
 * para verlas sin conexión y para el evento `storage` entre pestañas. Si el envío
 * falla, `ApiSyncService` lo reintenta solo.
 */
@Injectable({ providedIn: 'root' })
export class ScheduleService implements OnDestroy {
  private static readonly STORAGE_KEY = 'itutor_scheduled_classes';
  private static readonly REFRESH_MS = 30_000;
  private zone = inject(NgZone);
  private http = inject(HttpClient, { optional: true });
  private sync = inject(ApiSyncService);
  private auth = inject(AuthService);
  private readonly apiUrl = environment.apiUrl || 'http://18.192.203.101:3000/api';
  private timer: ReturnType<typeof setInterval> | null = null;

  private classesSubject = new BehaviorSubject<ScheduledClass[]>(this.load());
  public classes$ = this.classesSubject.asObservable();

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key === ScheduleService.STORAGE_KEY) {
      this.zone.run(() => this.classesSubject.next(this.load()));
    }
  };

  constructor() {
    window.addEventListener('storage', this.onStorage);
    if (this.http) {
      this.auth.currentUser$.subscribe(user => {
        if (user) {
          void this.refresh();
        }
      });
      this.timer = setInterval(() => void this.refresh(), ScheduleService.REFRESH_MS);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorage);
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private load(): ScheduledClass[] {
    try {
      const raw = localStorage.getItem(ScheduleService.STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  get classes(): ScheduledClass[] {
    return this.classesSubject.value;
  }

  getForTeacher(email: string): ScheduledClass[] {
    const e = (email || '').toLowerCase();
    return this.classes.filter(c => c.teacherEmail === e);
  }

  getForStudent(email: string): ScheduledClass[] {
    const e = (email || '').toLowerCase();
    return this.classes.filter(c => c.studentEmail === e);
  }

  /** Indica si el profesor ya tiene otra clase que se solapa con el hueco indicado */
  hasConflict(teacherEmail: string, start: string, durationMin: number): boolean {
    const begin = new Date(start).getTime();
    const end = begin + durationMin * 60000;
    return this.getForTeacher(teacherEmail).some(c => {
      const cBegin = new Date(c.start).getTime();
      const cEnd = cBegin + c.durationMin * 60000;
      return begin < cEnd && cBegin < end;
    });
  }

  /** Agenda una nueva clase, la guarda en este dispositivo y la envía al servidor */
  schedule(data: Omit<ScheduledClass, 'id' | 'createdAt'>): ScheduledClass {
    const created: ScheduledClass = {
      ...data,
      teacherEmail: data.teacherEmail.toLowerCase(),
      studentEmail: data.studentEmail.toLowerCase(),
      id: `CLS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now()
    };
    this.persist([...this.load(), created]);
    // Se guarda en el servidor; si falla queda en cola y se reintenta solo.
    void this.sync.send('/sessions', this.toRow(created));
    return created;
  }

  /**
   * Descarga del servidor las clases del usuario en sesión (el administrador, todas)
   * y las fusiona con las locales por id: nada se duplica y las pendientes de
   * enviar no se pierden.
   */
  async refresh(): Promise<void> {
    const user = this.auth.currentUserValue;
    if (!this.http || !user) {
      return;
    }
    try {
      const params: Record<string, string> = user.role === 'Admin' ? {} : { email: user.email.toLowerCase() };
      const rows = await firstValueFrom(
        this.http.get<SessionRow[]>(`${this.apiUrl}/sessions`, { params }).pipe(timeout(8000))
      );
      if (!Array.isArray(rows)) {
        return;
      }
      const byId = new Map<string, ScheduledClass>();
      for (const c of this.load()) {
        byId.set(c.id, c);
      }
      for (const row of rows) {
        // Las filas del seed (histórico de ejemplo) no tienen email: no son clases agendadas.
        if (row.studentEmail && row.teacherEmail && row.startAt) {
          byId.set(row._id, this.fromRow(row, byId.get(row._id)));
        }
      }
      const merged = [...byId.values()];
      if (JSON.stringify(merged) !== JSON.stringify(this.load())) {
        this.persist(merged);
      }
    } catch {
      // sin conexión: se siguen mostrando las clases guardadas en este dispositivo
    }
  }

  private persist(next: ScheduledClass[]): void {
    try {
      localStorage.setItem(ScheduleService.STORAGE_KEY, JSON.stringify(next));
    } catch {
      // cuota llena: se mantiene en memoria
    }
    this.classesSubject.next(next);
  }

  private toRow(c: ScheduledClass): Record<string, unknown> {
    const monthIdx = Number(c.start.split('T')[0].split('-')[1]) - 1;
    return {
      _id: c.id,
      studentEmail: c.studentEmail,
      teacherEmail: c.teacherEmail,
      estudianteNombre: c.studentName,
      tutor: c.teacherName,
      materia: c.subject,
      rama: c.branch || 'Matemáticas',
      topic: c.topic,
      startAt: c.start,
      mes: MONTHS[monthIdx] ?? '',
      duracionMin: c.durationMin,
      importe: c.price,
      estado: 'Confirmada',
      asistencia: false,
      notasSeguimiento: c.notes
    };
  }

  private fromRow(row: SessionRow, previous?: ScheduledClass): ScheduledClass {
    return {
      id: row._id,
      teacherEmail: (row.teacherEmail || '').toLowerCase(),
      teacherName: row.tutor || row.teacherEmail || '',
      studentEmail: (row.studentEmail || '').toLowerCase(),
      studentName: row.estudianteNombre || row.studentEmail || '',
      subject: row.materia || 'Tutoría',
      topic: row.topic || '',
      start: row.startAt || '',
      durationMin: row.duracionMin || 90,
      price: row.importe || 0,
      notes: row.notasSeguimiento || '',
      createdAt: previous?.createdAt ?? 0,
      branch: row.rama
    };
  }
}