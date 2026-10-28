import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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
}

/**
 * Servicio de agenda de clases de iTUTOR.
 *
 * Persiste las clases en `localStorage` y escucha el evento `storage` para que
 * una clase agendada por la profesora en una pestaña aparezca al instante en el
 * calendario de la alumna abierto en otra pestaña del mismo navegador.
 */
@Injectable({ providedIn: 'root' })
export class ScheduleService implements OnDestroy {
  private static readonly STORAGE_KEY = 'itutor_scheduled_classes';
  private zone = inject(NgZone);

  private classesSubject = new BehaviorSubject<ScheduledClass[]>(this.load());
  public classes$ = this.classesSubject.asObservable();

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key === ScheduleService.STORAGE_KEY) {
      this.zone.run(() => this.classesSubject.next(this.load()));
    }
  };

  constructor() {
    window.addEventListener('storage', this.onStorage);
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorage);
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

  /** Agenda una nueva clase y la persiste */
  schedule(data: Omit<ScheduledClass, 'id' | 'createdAt'>): ScheduledClass {
    const created: ScheduledClass = {
      ...data,
      teacherEmail: data.teacherEmail.toLowerCase(),
      studentEmail: data.studentEmail.toLowerCase(),
      id: `CLS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now()
    };
    const next = [...this.load(), created];
    localStorage.setItem(ScheduleService.STORAGE_KEY, JSON.stringify(next));
    this.classesSubject.next(next);
    return created;
  }
}
