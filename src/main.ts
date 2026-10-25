import { bootstrapApplication } from '@angular/platform-browser';
import { isDevMode } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { IonicRouteStrategy } from '@ionic/angular/ionic-route-strategy';
import { provideIonicAngular } from '@ionic/angular/provide';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { IdlePreloadingStrategy } from './app/core/strategies/idle-preloading.strategy';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    // Precarga diferida en reposo: no compite con el primer pintado en móvil.
    provideRouter(routes, withPreloading(IdlePreloadingStrategy), withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // PWA: service worker solo en producción. Se registra cuando la app queda
    // estable (o a los 30 s) para no competir con la carga inicial.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
});
