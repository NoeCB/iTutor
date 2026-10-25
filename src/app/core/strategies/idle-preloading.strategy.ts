import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, EMPTY, timer, switchMap } from 'rxjs';

/** Retardo mínimo antes de empezar a precargar módulos diferidos (ms). */
const PRELOAD_DELAY_MS = 3000;

/** Subconjunto de la Network Information API (no tipada en todos los navegadores). */
interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Estrategia de precarga diferida "en reposo" (rendimiento móvil / Lighthouse).
 *
 * `PreloadAllModules` descarga todas las rutas lazy en cuanto termina la
 * primera navegación. En móvil eso hace que el dashboard, Chart.js y jsPDF
 * compitan por el ancho de banda con la propia pantalla de login, retrasando
 * el FCP y el LCP.
 *
 * Esta estrategia mantiene la ventaja de la precarga (navegación instantánea
 * después de iniciar sesión) pero:
 *  1. Espera `PRELOAD_DELAY_MS` y a que el navegador esté inactivo
 *     (`requestIdleCallback`) antes de descargar nada.
 *  2. No precarga en conexiones lentas (2G) ni con "Ahorro de datos" activo.
 *  3. Permite excluir rutas concretas con `data: { preload: false }`.
 */
@Injectable({ providedIn: 'root' })
export class IdlePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (route.data?.['preload'] === false || this.isConstrainedNetwork()) {
      return EMPTY;
    }
    return timer(PRELOAD_DELAY_MS).pipe(switchMap(() => this.whenIdle()), switchMap(() => load()));
  }

  /** Emite cuando el hilo principal queda libre (o tras 2 s como máximo). */
  private whenIdle(): Observable<void> {
    return new Observable<void>(subscriber => {
      const done = () => {
        subscriber.next();
        subscriber.complete();
      };
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const id = window.requestIdleCallback(done, { timeout: 2000 });
        return () => window.cancelIdleCallback(id);
      }
      const id = setTimeout(done, 0);
      return () => clearTimeout(id);
    });
  }

  /** Detecta redes lentas o modo "Ahorro de datos" para no gastar datos móviles. */
  private isConstrainedNetwork(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }
    const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
    if (!connection) {
      return false;
    }
    return connection.saveData === true || /(^|-)2g$/.test(connection.effectiveType ?? '');
  }
}
