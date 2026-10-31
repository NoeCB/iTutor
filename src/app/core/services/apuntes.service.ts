import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject, firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Apunte tal y como lo devuelve el servidor (solo metadatos: el PDF se pide aparte). */
export interface ApunteItem {
  id: string;
  title: string;
  subject: string;
  teacher: string;
  /** Email del profesor que lo subió. Vacío = apunte compartido con todos. */
  teacherEmail?: string;
  date: string;
  size: string;
  pages: number;
  summary: string;
  fileName?: string;
  /** El servidor (o este dispositivo, si está pendiente) tiene el PDF. */
  hasFile?: boolean;
  fileBytes?: number;
  sha256?: string;
  /** `true` = guardado solo en este dispositivo, el servidor aún no lo ha confirmado. */
  pending?: boolean;
}

/** Datos que rellena el profesor al subir; el resto se calcula a partir del archivo. */
export type ApunteInput = Pick<ApunteItem, 'title' | 'subject' | 'teacher' | 'teacherEmail' | 'summary'>;

export type UploadOutcome =
  | { status: 'saved'; id: string }
  /** `durable: false` = ni siquiera IndexedDB ha podido guardarlo: se perdería al cerrar la pestaña. */
  | { status: 'queued'; id: string; durable: boolean }
  | { status: 'rejected'; reason: string };

interface PendingRecord {
  id: string;
  item: ApunteItem;
  blob: Blob;
  attempts: number;
  nextTryAt: number;
  createdAt: number;
}

/**
 * Cola persistente de PDFs pendientes de enviar. Usa IndexedDB (admite Blobs de
 * varios MB) en lugar de `localStorage`, cuya cuota (~5 MB por origen, en
 * base64 ≈ 3,5 MB de PDF) era justo lo que rompía la subida. Si el navegador no
 * ofrece IndexedDB o no queda espacio, se degrada a memoria y se avisa al usuario.
 */
class PendingStore {
  private static readonly DB = 'itutor-apuntes';
  private static readonly STORE = 'pending';
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly memory = new Map<string, PendingRecord>();
  private durable = typeof indexedDB !== 'undefined';

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(PendingStore.DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(PendingStore.STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IndexedDB bloqueada'));
      }).catch(error => {
        this.durable = false;
        throw error;
      });
    }
    return this.dbPromise;
  }

  private async run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(PendingStore.STORE, mode);
      const req = op(tx.objectStore(PendingStore.STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  /** Devuelve `true` si quedó guardado de forma duradera (sobrevive a cerrar la pestaña). */
  async put(rec: PendingRecord): Promise<boolean> {
    if (this.durable) {
      try {
        await this.run('readwrite', s => s.put(rec));
        this.memory.delete(rec.id);
        return true;
      } catch {
        // Sin espacio o IndexedDB no disponible: se conserva al menos en memoria.
      }
    }
    this.memory.set(rec.id, rec);
    return false;
  }

  async get(id: string): Promise<PendingRecord | undefined> {
    const inMemory = this.memory.get(id);
    if (inMemory) {
      return inMemory;
    }
    if (!this.durable) {
      return undefined;
    }
    try {
      return (await this.run('readonly', s => s.get(id))) as PendingRecord | undefined;
    } catch {
      return undefined;
    }
  }

  async delete(id: string): Promise<void> {
    this.memory.delete(id);
    if (this.durable) {
      try {
        await this.run('readwrite', s => s.delete(id));
      } catch {
        // ignore
      }
    }
  }

  async all(): Promise<PendingRecord[]> {
    const byId = new Map<string, PendingRecord>();
    if (this.durable) {
      try {
        for (const rec of (await this.run('readonly', s => s.getAll())) as PendingRecord[]) {
          byId.set(rec.id, rec);
        }
      } catch {
        // ignore
      }
    }
    for (const rec of this.memory.values()) {
      byId.set(rec.id, rec);
    }
    return [...byId.values()];
  }
}

/**
 * Apuntes (PDFs) con persistencia en el servidor (SQLite en AWS).
 *
 * Garantías:
 *  - El PDF se guarda primero en IndexedDB y después se sube; nada depende de la
 *    cuota de `localStorage` y un fallo de red no pierde el archivo.
 *  - Los errores nunca son silenciosos: `upload()` devuelve `saved`, `queued` o
 *    `rejected` (con el motivo) para que la interfaz lo muestre.
 *  - Lo pendiente se reintenta solo (al abrir, al recuperar conexión, cada 30 s)
 *    con espera creciente.
 *  - Sin duplicados: el id sale del contenido del archivo + profesor, así que
 *    reintentar o volver a subir el mismo PDF actualiza el mismo apunte; además
 *    el servidor es idempotente por id.
 */
@Injectable({ providedIn: 'root' })
export class ApuntesService {
  /** Límite de tamaño por PDF. El servidor acepta hasta 8 MB; se deja margen por el proxy de Vercel (4,5 MB). */
  static readonly MAX_PDF_BYTES = 4 * 1024 * 1024;
  private static readonly RETRY_MS = 30_000;
  private static readonly MAX_BACKOFF_MS = 5 * 60_000;
  private static readonly CACHE_PREFIX = 'itutor_apuntes_cache:';
  private static readonly LEGACY_NOTES_KEY = 'itutor_uploaded_notes';
  private static readonly LEGACY_PENDING_KEY = 'itutor_pending_note_ids';

  private http = inject(HttpClient, { optional: true });
  private readonly apiUrl = environment.apiUrl || 'http://18.192.203.101:3000/api';
  private readonly store = new PendingStore();
  private flushing = false;

  /** Emite cuando cambia algo en segundo plano (un pendiente se subió o se descartó). */
  readonly changed$ = new Subject<void>();

  constructor() {
    if (this.http && typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.retryPending(true));
      setInterval(() => void this.retryPending(), ApuntesService.RETRY_MS);
      void this.retryPending(true);
    }
  }

  /** Comprueba tamaño, tipo y firma `%PDF-`. Devuelve el motivo del rechazo, o `null` si es válido. */
  async validateFile(file: File): Promise<string | null> {
    if (file.size === 0) {
      return 'El archivo está vacío.';
    }
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      return 'Solo se admiten archivos PDF.';
    }
    if (file.size > ApuntesService.MAX_PDF_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return `El PDF pesa ${mb} MB y el máximo es ${ApuntesService.MAX_PDF_BYTES / 1024 / 1024} MB. Comprímelo o divídelo en varios archivos.`;
    }
    try {
      const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      if (String.fromCharCode(...head) !== '%PDF-') {
        return 'El archivo no es un PDF válido.';
      }
    } catch {
      return 'No se ha podido leer el archivo seleccionado.';
    }
    return null;
  }

  /** Guarda el PDF en este dispositivo y lo sube al servidor. */
  async upload(file: File, input: ApunteInput): Promise<UploadOutcome> {
    const problem = await this.validateFile(file);
    if (problem) {
      return { status: 'rejected', reason: problem };
    }
    const id = await this.buildId(file, input.teacherEmail);
    const record: PendingRecord = {
      id,
      item: {
        ...input,
        id,
        date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
        size: this.humanSize(file.size),
        pages: 1,
        fileName: file.name,
        hasFile: true,
        fileBytes: file.size,
        pending: true
      },
      blob: file,
      attempts: 0,
      nextTryAt: 0,
      createdAt: Date.now()
    };
    const durable = await this.store.put(record);
    const outcome = await this.send(record);
    return outcome.status === 'queued' ? { ...outcome, durable } : outcome;
  }

  /** Reintenta lo pendiente. `force` ignora la espera entre intentos. */
  async retryPending(force = false): Promise<void> {
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    try {
      let changed = false;
      for (const rec of await this.store.all()) {
        if (!force && rec.nextTryAt > Date.now()) {
          continue;
        }
        const outcome = await this.send(rec);
        changed = changed || outcome.status !== 'queued';
      }
      if (changed) {
        this.changed$.next();
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Apuntes visibles para `viewerEmail`: los del servidor (filtrados por profesor
   * asignado) más los pendientes de este dispositivo. Sin repetidos.
   * Si no hay conexión usa la última copia de los metadatos y lo indica en `offline`.
   */
  async list(viewerEmail: string | null): Promise<{ items: ApunteItem[]; offline: boolean }> {
    const viewer = (viewerEmail || '').trim().toLowerCase();
    let remote: ApunteItem[] = [];
    let offline = false;
    const cacheKey = ApuntesService.CACHE_PREFIX + viewer;

    try {
      if (!this.http) {
        throw new Error('sin cliente HTTP');
      }
      const params: Record<string, string> = viewer ? { viewer } : {};
      const res = await firstValueFrom(
        this.http.get<ApunteItem[]>(`${this.apiUrl}/apuntes`, { params }).pipe(timeout(8000))
      );
      remote = Array.isArray(res) ? res : [];
      try {
        localStorage.setItem(cacheKey, JSON.stringify(remote)); // solo metadatos: pocos KB
      } catch {
        // cuota llena: la caché es opcional
      }
    } catch {
      offline = true;
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        remote = Array.isArray(cached) ? cached : [];
      } catch {
        remote = [];
      }
    }

    const byId = new Map<string, ApunteItem>();
    // El servidor devuelve del más antiguo al más nuevo: se invierte para ver primero lo reciente.
    for (const item of [...remote].reverse()) {
      byId.set(item.id, item);
    }

    const pending: ApunteItem[] = [];
    for (const rec of await this.store.all()) {
      const owner = (rec.item.teacherEmail || '').toLowerCase();
      if (owner && viewer && owner !== viewer) {
        continue; // pendiente de otro profesor que usó este dispositivo
      }
      const onServer = byId.get(rec.id);
      if (onServer?.hasFile) {
        await this.store.delete(rec.id); // se subió pero la respuesta se perdió: ya no hace falta
        continue;
      }
      pending.push({ ...rec.item, pending: true });
    }

    return { items: [...pending, ...byId.values()], offline };
  }

  /** Obtiene el contenido del PDF (del dispositivo si está pendiente, si no del servidor). */
  async getBlob(item: ApunteItem): Promise<Blob> {
    if (item.pending) {
      const rec = await this.store.get(item.id);
      if (rec) {
        return rec.blob;
      }
    }
    if (!this.http) {
      throw new Error('Sin conexión con el servidor.');
    }
    return firstValueFrom(
      this.http
        .get(`${this.apiUrl}/apuntes/${encodeURIComponent(item.id)}/file`, { responseType: 'blob' })
        .pipe(timeout(30_000))
    );
  }

  /**
   * Antes los PDFs se guardaban como data URL en `localStorage` y, si el envío
   * fallaba, se quedaban ahí sin reintentarse nunca. Se pasan a la cola nueva
   * (IndexedDB) a nombre de `owner` y se libera esa cuota.
   */
  async migrateLegacyLocalNotes(owner: { email: string; name: string }): Promise<void> {
    let legacy: (ApunteItem & { fileDataUrl?: string })[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(ApuntesService.LEGACY_NOTES_KEY) || '[]');
      legacy = Array.isArray(parsed) ? parsed : [];
    } catch {
      legacy = [];
    }
    if (legacy.length === 0) {
      return;
    }
    for (const note of legacy) {
      if (!note?.id || !note.fileDataUrl?.startsWith('data:')) {
        continue;
      }
      try {
        const blob = await (await fetch(note.fileDataUrl)).blob();
        const { fileDataUrl: _drop, ...meta } = note;
        void _drop;
        await this.store.put({
          id: note.id,
          item: { ...meta, teacherEmail: owner.email.toLowerCase(), teacher: meta.teacher || owner.name, hasFile: true, pending: true },
          blob,
          attempts: 0,
          nextTryAt: 0,
          createdAt: Date.now()
        });
      } catch {
        // dato local corrupto: se descarta
      }
    }
    localStorage.removeItem(ApuntesService.LEGACY_NOTES_KEY);
    localStorage.removeItem(ApuntesService.LEGACY_PENDING_KEY);
    void this.retryPending(true);
  }

  // ---------------------------------------------------------------------------

  private async send(rec: PendingRecord): Promise<UploadOutcome> {
    if (!this.http) {
      return { status: 'queued', id: rec.id, durable: true };
    }
    const meta = {
      title: rec.item.title,
      subject: rec.item.subject,
      teacher: rec.item.teacher,
      teacherEmail: rec.item.teacherEmail || '',
      date: rec.item.date,
      pages: rec.item.pages,
      summary: rec.item.summary,
      fileName: rec.item.fileName
    };
    try {
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/apuntes/${encodeURIComponent(rec.id)}/file`, rec.blob, {
          headers: {
            'Content-Type': 'application/pdf',
            // Los metadatos van en cabecera (el cuerpo es el PDF en binario); codificados para admitir tildes.
            'X-Apunte-Meta': encodeURIComponent(JSON.stringify(meta))
          }
        })
      );
      await this.store.delete(rec.id);
      return { status: 'saved', id: rec.id };
    } catch (error) {
      if (this.isRetryable(error)) {
        console.warn(`[iTUTOR] No se pudo subir el apunte ${rec.id}; se reintentará.`, error);
        rec.attempts += 1;
        rec.nextTryAt = Date.now() + Math.min(ApuntesService.MAX_BACKOFF_MS, 15_000 * 2 ** (rec.attempts - 1));
        await this.store.put(rec);
        return { status: 'queued', id: rec.id, durable: true };
      }
      console.error(`[iTUTOR] El servidor rechazó el apunte ${rec.id}:`, error);
      await this.store.delete(rec.id);
      return { status: 'rejected', reason: this.describe(error) };
    }
  }

  /** Sin red, timeout, 429, 5xx o ruta aún no desplegada (404/501): merece la pena reintentar. */
  private isRetryable(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return true;
    }
    const s = error.status;
    return s === 0 || s === 404 || s === 408 || s === 429 || s >= 500;
  }

  private describe(error: unknown): string {
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    switch (status) {
      case 400:
        return 'El servidor no ha entendido los datos del apunte.';
      case 409:
        return 'Ya existe un apunte con ese identificador de otro profesor/a.';
      case 413:
        return 'El PDF es demasiado grande para el servidor. Comprímelo o divídelo.';
      case 415:
        return 'El servidor indica que el archivo no es un PDF válido.';
      default:
        return `El servidor ha rechazado el archivo (error ${status || 'desconocido'}).`;
    }
  }

  /** Id estable: mismo profesor + mismo contenido = mismo apunte (no se duplica al reintentar). */
  private async buildId(file: File, ownerEmail?: string): Promise<string> {
    try {
      if (globalThis.crypto?.subtle) {
        const prefix = new TextEncoder().encode(`${(ownerEmail || '').toLowerCase()}\n`);
        const body = new Uint8Array(await file.arrayBuffer());
        const all = new Uint8Array(prefix.length + body.length);
        all.set(prefix, 0);
        all.set(body, prefix.length);
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', all));
        const hex = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
        return `AP-UP-${hex.slice(0, 16).toUpperCase()}`;
      }
    } catch {
      // sin Web Crypto (p. ej. http sin TLS): se usa un id aleatorio
    }
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
    return `AP-UP-${Date.now().toString(36).toUpperCase()}${rand}`;
  }

  private humanSize(bytes: number): string {
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
}
