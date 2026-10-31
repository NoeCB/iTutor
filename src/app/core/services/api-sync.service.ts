import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Resultado de un intento de guardado en el servidor:
 * - `saved`:    el servidor lo ha guardado.
 * - `queued`:   no se pudo (sin red, servidor caído, endpoint aún no desplegado…).
 *               Si se pidió `persist`, queda en cola y se reintentará solo.
 * - `rejected`: el servidor lo ha rechazado de forma definitiva (400, 409, 413…).
 * - `offline`:  no hay cliente HTTP disponible (p. ej. en pruebas unitarias).
 */
export type SyncResult = 'saved' | 'queued' | 'rejected' | 'offline';

interface QueuedRequest {
  path: string;
  body: unknown;
}

/**
 * Envía datos al backend (AWS) sin perderlos en silencio.
 *
 * Antes cada servicio hacía `http.post(...).subscribe({ error: () => {} })`:
 * si la petición fallaba no quedaba rastro y el dato solo existía en el
 * `localStorage` de ese navegador. Ahora:
 *  - se informa del resultado (`SyncResult`) para poder avisar al usuario,
 *  - los fallos recuperables se guardan en una cola persistente y se reintentan
 *    al arrancar, al recuperar la conexión y cada 30 s,
 *  - los fallos definitivos se registran en consola.
 *
 * Todos los endpoints a los que se envía son idempotentes en el servidor
 * (upsert o 409 si ya existe), así que reintentar nunca duplica datos.
 */
@Injectable({ providedIn: 'root' })
export class ApiSyncService {
  private static readonly QUEUE_KEY = 'itutor_sync_queue';
  private static readonly RETRY_MS = 30_000;

  private http = inject(HttpClient, { optional: true });
  private readonly apiUrl = environment.apiUrl || 'http://18.192.203.101:3000/api';
  private flushing = false;

  constructor() {
    if (this.http && typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.flush());
      setInterval(() => void this.flush(), ApiSyncService.RETRY_MS);
      void this.flush();
    }
  }

  /** Número de envíos pendientes de reintento. */
  get pendingCount(): number {
    return this.readQueue().length;
  }

  /**
   * Envía `body` por POST a `path` (relativo a la API, p. ej. `/auth/register`).
   * @param persist si es `true`, un fallo recuperable se guarda en la cola
   *   persistente. Usar `false` para cuerpos muy grandes (PDF) que el llamador
   *   ya guarda por su cuenta y reintenta él mismo.
   */
  async send(path: string, body: unknown, persist = true): Promise<SyncResult> {
    if (!this.http) {
      return 'offline';
    }
    try {
      await firstValueFrom(this.http.post(`${this.apiUrl}${path}`, body));
      return 'saved';
    } catch (error) {
      if (this.isRetryable(error)) {
        console.warn(`[iTUTOR] No se pudo guardar en el servidor (${path}); se reintentará.`, error);
        if (persist) {
          this.enqueue({ path, body });
        }
        return 'queued';
      }
      console.error(`[iTUTOR] El servidor rechazó ${path}:`, error);
      return 'rejected';
    }
  }

  /** Reintenta, en orden, todo lo que quedó pendiente. */
  async flush(): Promise<void> {
    if (!this.http || this.flushing) {
      return;
    }
    this.flushing = true;
    try {
      const queue = this.readQueue();
      if (queue.length === 0) {
        return;
      }
      const remaining: QueuedRequest[] = [];
      for (const item of queue) {
        try {
          await firstValueFrom(this.http.post(`${this.apiUrl}${item.path}`, item.body));
        } catch (error) {
          if (this.isRetryable(error)) {
            remaining.push(item);
          } else {
            console.error(`[iTUTOR] Descartado envío pendiente ${item.path}:`, error);
          }
        }
      }
      this.writeQueue(remaining);
    } finally {
      this.flushing = false;
    }
  }

  /** Errores que merece la pena reintentar: sin red, timeout, 429, 5xx o endpoint aún inexistente (404). */
  private isRetryable(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return true;
    }
    const s = error.status;
    return s === 0 || s === 404 || s === 408 || s === 429 || s >= 500;
  }

  private enqueue(item: QueuedRequest): void {
    this.writeQueue([...this.readQueue(), item]);
  }

  private readQueue(): QueuedRequest[] {
    try {
      const raw = localStorage.getItem(ApiSyncService.QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeQueue(queue: QueuedRequest[]): void {
    try {
      if (queue.length === 0) {
        localStorage.removeItem(ApiSyncService.QUEUE_KEY);
      } else {
        localStorage.setItem(ApiSyncService.QUEUE_KEY, JSON.stringify(queue));
      }
    } catch (error) {
      console.warn('[iTUTOR] No se pudo persistir la cola de sincronización.', error);
    }
  }
}
