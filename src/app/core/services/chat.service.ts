import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiSyncService } from './api-sync.service';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Mensaje de chat entre dos usuarios de iTUTOR (identificados por email) */
export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  ts: number;
}

/** Marca de lectura: lector -> contacto -> timestamp del último mensaje leído */
type ReadMarks = Record<string, Record<string, number>>;

/**
 * Servicio de mensajería en tiempo real de iTUTOR.
 *
 * Todos los mensajes se guardan en `localStorage` (simulando el backend) y se
 * sincronizan entre pestañas mediante el evento `storage`. Así, si la profesora
 * Elena y la alumna Paula tienen sesión abierta en dos pestañas, cada mensaje
 * enviado por una aparece al instante en la ventana de la otra.
 */
@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private static readonly MESSAGES_KEY = 'itutor_chat_messages';
  private static readonly READS_KEY = 'itutor_chat_reads';
  private zone = inject(NgZone);
  private http = inject(HttpClient, { optional: true });
  private sync = inject(ApiSyncService);
  private readonly apiUrl = environment.apiUrl || 'http://88.26.12.64:3000/api';
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  private reads: ReadMarks = {};

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key === ChatService.MESSAGES_KEY || event.key === ChatService.READS_KEY) {
      this.zone.run(() => this.reload());
    }
  };

  constructor() {
    this.seedIfEmpty();
    this.reload();
    window.addEventListener('storage', this.onStorage);
    this.syncFromApi();
    if (this.http) {
      this.pollTimer = setInterval(() => this.syncFromApi(), 4000);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorage);
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  /** Sincroniza los mensajes con la base de datos SQLite en la Banana Pi */
  private syncFromApi(): void {
    if (!this.http) return;
    this.http.get<ChatMessage[]>(`${this.apiUrl}/messages`).subscribe({
      next: remoteMsgs => {
        if (!Array.isArray(remoteMsgs) || remoteMsgs.length === 0) return;
        const local = this.readJson<ChatMessage[]>(ChatService.MESSAGES_KEY, []);
        const byId = new Map<string, ChatMessage>();
        for (const m of local) byId.set(m.id, m);
        let added = false;
        for (const rm of remoteMsgs) {
          if (!byId.has(rm.id)) {
            byId.set(rm.id, rm);
            added = true;
          }
        }
        if (added) {
          const merged = [...byId.values()].sort((a, b) => a.ts - b.ts);
          localStorage.setItem(ChatService.MESSAGES_KEY, JSON.stringify(merged));
          this.messagesSubject.next(merged);
        }
      },
      error: () => {
        // Fallback silencioso a localStorage si la Banana Pi no está accesible
      }
    });
  }

  private reload(): void {
    this.reads = this.readJson<ReadMarks>(ChatService.READS_KEY, {});
    this.messagesSubject.next(this.readJson<ChatMessage[]>(ChatService.MESSAGES_KEY, []));
  }

  private readJson<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private get messages(): ChatMessage[] {
    return this.messagesSubject.value;
  }

  /** Conversación ordenada cronológicamente entre dos usuarios */
  getThread(a: string, b: string): ChatMessage[] {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return this.messages
      .filter(m => (m.from === x && m.to === y) || (m.from === y && m.to === x))
      .sort((m1, m2) => m1.ts - m2.ts);
  }

  /** Emails de todos los usuarios con los que `email` tiene conversación */
  getContactsOf(email: string): string[] {
    const me = email.toLowerCase();
    const set = new Set<string>();
    for (const m of this.messages) {
      if (m.from === me) set.add(m.to);
      if (m.to === me) set.add(m.from);
    }
    return [...set];
  }

  /** Timestamp del último mensaje entre dos usuarios (0 si no hay) */
  lastActivity(a: string, b: string): number {
    const thread = this.getThread(a, b);
    return thread.length ? thread[thread.length - 1].ts : 0;
  }

  /** Mensajes recibidos por `reader` de `contact` aún no leídos */
  unreadFrom(reader: string, contact: string): number {
    const r = reader.toLowerCase();
    const c = contact.toLowerCase();
    const lastRead = this.reads[r]?.[c] ?? 0;
    return this.messages.filter(m => m.from === c && m.to === r && m.ts > lastRead).length;
  }

  /** Total de mensajes no leídos de un usuario */
  totalUnread(reader: string): number {
    return this.getContactsOf(reader).reduce((sum, c) => sum + this.unreadFrom(reader, c), 0);
  }

  /** Marca como leída la conversación de `reader` con `contact` */
  markRead(reader: string, contact: string): void {
    const r = reader.toLowerCase();
    const c = contact.toLowerCase();
    if (this.unreadFrom(r, c) === 0) return;
    this.reads = this.readJson<ReadMarks>(ChatService.READS_KEY, {});
    this.reads[r] = { ...(this.reads[r] || {}), [c]: Date.now() };
    localStorage.setItem(ChatService.READS_KEY, JSON.stringify(this.reads));
    this.messagesSubject.next([...this.messages]);
  }

  /** Envía un mensaje y lo persiste (se propaga a las demás pestañas) */
  send(from: string, to: string, text: string): ChatMessage | null {
    const clean = text.trim();
    if (!clean) return null;
    const msg: ChatMessage = {
      id: `MSG-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      text: clean,
      ts: Date.now()
    };
    const next = [...this.readJson<ChatMessage[]>(ChatService.MESSAGES_KEY, []), msg];
    localStorage.setItem(ChatService.MESSAGES_KEY, JSON.stringify(next));
    this.messagesSubject.next(next);
    // Se guarda en el servidor; si falla queda en cola y se reintenta solo.
    void this.sync.send('/messages', msg);
    return msg;
  }

  /** Formatea la hora de un mensaje: HH:mm (hoy), "Ayer" o "dd mmm" */
  formatTime(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
    const hhmm = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return hhmm;
    if (yesterday) return `Ayer ${hhmm}`;
    return `${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} ${hhmm}`;
  }

  /** Carga inicial de conversaciones de ejemplo (solo la primera vez) */
  private seedIfEmpty(): void {
    if (localStorage.getItem(ChatService.MESSAGES_KEY)) return;

    const paula = 'paulagarcia@itutor.es';
    const elena = 'elenaramos@itutor.es';
    const carlos = 'carlosmendez@itutor.es';
    const miguel = 'miguelsantos@itutor.es';
    const noelia = 'noeliacantador@itutor.es';
    const at = (iso: string) => new Date(iso).getTime();

    const seed: [string, string, string, number][] = [
      [noelia, paula, '¡Bienvenida a iTUTOR, Paula! Tu bono de tutorías de Octubre ya está confirmado y todas tus clases aparecen en tu calendario.', at('2026-10-01T09:00')],
      [carlos, paula, 'Buenas tardes Paula, recuerda repasar el cálculo del Jacobiano para las integrales dobles en polares.', at('2026-10-07T17:00')],
      [paula, carlos, 'Perfecto Carlos, ya he terminado los 4 primeros ejercicios del boletín.', at('2026-10-07T17:20')],
      [elena, paula, '¡Hola Paula! Te he dejado subidos en "Mis Apuntes" el PDF con los ejercicios sobre Transformada de Laplace.', at('2026-10-08T10:15')],
      [paula, elena, '¡Muchas gracias Elena! Los estoy revisando ahora mismo. ¿En la clase del día 10 veremos también sistemas de ecuaciones diferenciales?', at('2026-10-08T10:18')],
      [elena, paula, '¡Sí! En los últimos 30 minutos de la sesión del 10 de octubre resolveremos un sistema acoplado de 2º orden tipo examen. ¡Nos vemos en la Sala #04!', at('2026-10-08T10:21')],
      [noelia, miguel, 'Hola Miguel Ángel, ¿se ha completado la sesión de Termodinámica de Alejandro Gómez sin incidencias?', at('2026-10-08T16:00')],
      [miguel, noelia, 'Buenas tardes Noelia, sí, sesión completada y asistencia registrada. Muy buen aprovechamiento del contenido por parte del alumno.', at('2026-10-08T16:30')],
      [noelia, miguel, 'Magnífico. Queda validada en el registro oficial de sesiones.', at('2026-10-08T16:45')],
      [noelia, elena, 'Hola Elena, ¿cómo avanza el seguimiento de las tutorías de Física y Mecánica este mes?', at('2026-10-26T09:30')],
      [elena, noelia, 'Buenos días Noelia. Todo marcha según el plan docente. Marcos y Paula están completando las hojas de problemas y las actas de sesiones ya están cargadas en la plataforma.', at('2026-10-26T10:05')],
      [noelia, elena, 'Perfecto Elena, reviso las horas impartidas para validar los honorarios docentes de este ciclo. ¡Muchas gracias por el informe!', at('2026-10-26T10:15')],
      [elena, noelia, 'A ti, Noelia. Quedo a tu disposición para cualquier ajuste o nueva asignación en el calendario.', at('2026-10-26T10:20')],
      [noelia, carlos, 'Hola Carlos, confírmame por favor si has recibido la asignación de los nuevos alumnos para Cálculo y Álgebra.', at('2026-10-27T11:00')],
      [carlos, noelia, 'Hola Noelia, sí, todo recibido y verificado. Ya he fijado los horarios de tutorías en el calendario para el próximo mes.', at('2026-10-27T11:30')],
      [noelia, carlos, 'Excelente gestión. Avisamos a los estudiantes asignados para que confirmen sus reservas.', at('2026-10-27T11:40')]
    ];

    const messages: ChatMessage[] = seed.map(([from, to, text, ts], i) => ({
      id: `SEED-${i}`, from, to, text, ts
    }));

    // Los mensajes de ejemplo se consideran ya leídos: los "no leídos" serán
    // únicamente los mensajes reales que se envíen entre usuarios.
    const reads: ReadMarks = {};
    for (const m of messages) {
      reads[m.to] = { ...(reads[m.to] || {}), [m.from]: Math.max(reads[m.to]?.[m.from] ?? 0, m.ts) };
    }

    localStorage.setItem(ChatService.MESSAGES_KEY, JSON.stringify(messages));
    localStorage.setItem(ChatService.READS_KEY, JSON.stringify(reads));
  }
}
