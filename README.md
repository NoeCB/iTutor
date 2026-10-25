# iTUTOR — Sistema de Gestión Multiplataforma de Tutorías (PWA / Híbrida)

**Módulo Profesional:** Desarrollo de Interfaces (Código: 0488)  
**Ciclo Formativo:** Grado Superior en Desarrollo de Aplicaciones Multiplataforma (DAM)  
**Stack Tecnológico:** Ionic 8/9 + Angular Standalone + RxJS + Chart.js + jsPDF  

---

## 1. Credenciales de Acceso para Evaluación

La aplicación cuenta con control de acceso basado en roles (`Admin`, `Teacher` y `Standard`), validación reactiva/asíncrona de correo en tiempo real, protección de rutas mediante `CanActivateFn` ([`authGuard`](./src/app/core/guards/auth.guard.ts)) e inyección de tokens JWT mediante [`authInterceptor`](./src/app/core/interceptors/auth.interceptor.ts).

| Rol en el Sistema | Correo Electrónico | Contraseña | Ruta de Destino | Descripción de la Vista |
| :--- | :--- | :--- | :--- | :--- |
| **Administrador (Admin)** | `noeliacantador@itutor.es` | `noelia` | `/admin-dashboard` | Métricas, **Listado de Profesores (10)** y **Listado de Alumnos (10)**. *(Sin sección de apuntes)* |
| **Profesor Docente (Teacher)** | `elenaramos@itutor.es` | `elena` | `/portal-profesor` | **Portal Docente**: Expediente, alumnos que tiene a su cargo y **todo el dinero ganado**. |
| **Usuario Estándar (Alumna)** | `paulagarcia@itutor.es` | `paula` | `/mis-clases` | Portal de Alumna: Calendario interactivo, Mis Apuntes, Mensajería y Justificantes de Pago. |

---

## 2. Cumplimiento de las Fases del Proyecto y Rúbrica (RA 1 a RA 7)

### Fase 1: Estructuración y Renderizado Declarativo (RA 1 y RA 2)
* **Paso 1.1 — Sistema de Enrutamiento y Navegación:**
  * Menú lateral responsivo (`<ion-split-pane>` + `<ion-menu>`) en [`app.component.html`](./src/app/app.component.html) que adapta dinámicamente sus enlaces según el rol del usuario conectado.
  * Carga diferida (*Lazy Loading* con `loadComponent`) configurada en [`app.routes.ts`](./src/app/app.routes.ts).
  * Protección de rutas con [`authGuard`](./src/app/core/guards/auth.guard.ts) e interceptor funcional HTTP [`authInterceptor`](./src/app/core/interceptors/auth.interceptor.ts) registrado en [`main.ts`](./src/main.ts).
* **Paso 1.2 — Formularios y Validaciones Asíncronas:**
  * Pantalla de acceso profesional centrada en tarjeta (`<ion-card>`) con logotipo **iTUTOR** ([`login.page.html`](./src/app/features/login/login.page.html)).
  * `ReactiveFormsModule` + validador asíncrono personalizado (`emailExistsValidator`) contra [`AuthService`](./src/app/core/services/auth.service.ts) y renderizado optimizado con `ChangeDetectionStrategy.OnPush`.

### Fase 2: Componentización Visual y Lógica de Negocio (RA 3)
* **Paso 2.1 y 2.2 — Componentes Personalizados Agnósticos (`@Input` / `@Output`):**
  1. **[`StatCardComponent`](./src/app/shared/components/stat-card/stat-card.component.ts) (`<app-stat-card>`):** Widget estadístico reutilizable para KPIs con cálculo de variación porcentual.
  2. **[`DataTableComponent`](./src/app/shared/components/data-table/data-table.component.ts) (`<app-data-table>`):** Tabla de datos avanzada e instanciable con **buscador en tiempo real integrado** (`[(ngModel)]="searchTerm"`), formateo de divisas/estados y emisión de eventos (`@Output() onEdit`, `onDelete`, `onView`) hacia el componente padre.
  * Gestión del ciclo de vida (`ngOnInit`, `ngAfterViewInit`, `ngOnDestroy`) destruyendo las instancias de `Chart.js` al desmontar la vista para evitar fugas de memoria (*memory leaks*).

### Fase 3: Consumo de Datos y Generación de Informes (RA 5)
* **Paso 3.1 — Concurrencia y Asincronía (SQL + NoSQL):**
  * [`DataService`](./src/app/core/services/data.service.ts) orquesta de manera concurrente mediante `forkJoin` de RxJS dos fuentes de datos: catálogo relacional (**SQL**) y sesiones documentales en tiempo real (**NoSQL / MongoDB**).
* **Paso 3.2 — Dashboard Interactivo:**
  * Cuadro de mando para el rol Administrador ([`AdminDashboardPage`](./src/app/features/admin-dashboard/admin-dashboard.page.ts)) con segmentación temporal en vivo y gráficos interactivos con **Chart.js** (*Ingresos por Asignatura* y *Clases Impartidas*).
  * Portal interactivo para el rol Alumno ([`MisClasesPage`](./src/app/features/mis-clases/mis-clases.page.ts)) con **Calendario de Tutorías** (al pulsar en el **10 de octubre** despliega el recuadro de la tutoría de **Ecuaciones Diferenciales** con la **Dra. Elena Ramos**), **Mis Apuntes**, **Mensajes con Profesores** y **Dashboard de Facturación & Pagos**.
* **Paso 3.3 — Exportación de Datos (PDF y CSV):**
  * Generación y descarga de informes tabulados en **CSV** (con BOM UTF-8 compatible con Excel) y **PDF corporativo** mediante `jsPDF` y `jspdf-autotable`.

### Fase 4: Usabilidad, Accesibilidad y Control de Calidad (RA 4)
* **Paso 4.1 y 4.2 — Diseño Adaptativo (Mobile-First) y WCAG 2.1 AA:**
  * Uso de `ion-grid`, CSS Grid y Flexbox adaptativos para móvil, tablet y escritorio.
  * Landmarks semánticos WAI-ARIA (`role="banner"`, `role="main"`, `role="region"`, `aria-live="polite"`, `aria-label`), alto contraste cromático y navegación por teclado con `:focus-visible`.

---

## 3. Manual de Usuario Final
 
1. **Inicio de Sesión (`/login`):**
   * Introduce tu correo y contraseña en la tarjeta central de **iTUTOR**, o pulsa uno de los chips de acceso rápido de prueba (**Admin**, **Profesora** o **Alumna**).
   * El sistema verifica asíncronamente si el correo existe en la base de datos antes de habilitar el acceso.
2. **Vista de Administrador (`noeliacantador@itutor.es` / `noelia`):**
   * **Métricas & Sesiones:** Visualiza los 4 KPIs financieros/académicos, filtra por mes (*Todos, Sep, Oct, Nov, Dic*), consulta los gráficos Chart.js y exporta el informe de sesiones a PDF o CSV.
   * **Listado de Profesores (10):** Consulta el catálogo completo de los 10 profesores de iTUTOR con sus especialidades, alumnos asignados, horas dadas, total ganado y exportación de nóminas/censo.
   * **Listado de Alumnos (10):** Consulta el censo de los 10 alumnos matriculados, planes (Básico, Intensivo, Premium), profesor tutor asignado y saldos pendientes.
   * *(Nota: El rol Administrador no cuenta con sección de apuntes, centrando su panel en la gestión de docentes, alumnos y finanzas).*
3. **Vista de Profesor (`elenaramos@itutor.es` / `elena`):**
   * **Alumnos que tiene:** Tarjetas detalladas de los estudiantes asignados a su cargo, materias, horas cursadas y volumen económico generado.
   * **Todo el dinero ganado:** Desglose del total ganado en honorarios acumulados, tarifa/hora oficial y métricas de rendimiento.
   * **Histórico de clases:** Tabla interactiva de sesiones impartidas con buscador integrado.
   * **Liquidación en PDF:** Botón superior para descargar el certificado oficial de liquidación de honorarios.
4. **Vista de Alumna (`paulagarcia@itutor.es` / `paula`):**
   * **Mis Tutorías:** Explora el calendario de Octubre 2026 y haz clic en cualquier día con clase (ej. **10 de octubre**) para abrir el recuadro de detalle de **Ecuaciones Diferenciales** con la **Dra. Elena Ramos**.
   * **Mis Apuntes:** Filtra tus temas por asignatura y descarga los apuntes en PDF.
   * **Mensajes con Profesores:** Chatea en directo con tus profesores tutores.
   * **Facturación & Pagos:** Consulta el dashboard de todo lo que has pagado y descarga tus recibos en PDF.

---

## 4. Comandos de Ejecución, Documentación (Compodoc) y Despliegue

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar servidor de desarrollo
npm start

# 3. Compilar para producción (genera carpeta www/ lista para Vercel / Netlify / Firebase)
npm run build

# 4. Ejecutar la batería de pruebas unitarias (una sola pasada, sin modo watch)
npm run test:ci

# 5. Generar documentación técnica automatizada con Compodoc (carpeta documentation/)
npm run docs

# 6. Servir la documentación generada en el navegador (http://localhost:8080)
npm run docs:serve
```

> **Nota sobre la generación de documentación:** se emplea `tsconfig.doc.json` en
> lugar de `tsconfig.app.json`. Este último solo declara `src/main.ts` en su clave
> `files`, por lo que Compodoc no descubriría los componentes *standalone*
> cargados de forma diferida con `loadComponent()` y generaría una documentación
> vacía.

---

## 5. Control de Calidad: Pruebas Unitarias (Quality Gate)

El *pipeline* de integración continua ejecuta la batería de pruebas y **bloquea
el flujo si alguna falla**, antes de compilar el artefacto de producción.

| Suite de pruebas | Qué verifica |
| :--- | :--- |
| `auth.spec.ts` | Estado inicial anónimo, verificación de credenciales contra hash, cierre de sesión y resistencia a la manipulación de `localStorage` (escalada de privilegios). |
| `auth-guard.spec.ts` | Las dos capas del guard: autenticación y autorización por rol, incluida la política de supervisión del rol Admin. |
| `data.service.spec.ts` | Consumo de las fuentes SQL y NoSQL, orquestación concurrente con `forkJoin` y cálculos de agregación de honorarios. |
| `data-table.component.spec.ts` | El componente reutilizable: entrada por `@Input`, filtrado del buscador y emisión de eventos por `@Output`. |

---

## 6. Nota Técnica sobre el Modelo de Seguridad (Alcance Académico)

Para que la evaluación sea transparente, se detalla el alcance real de la capa
de autenticación implementada:

* **Sin sesión por defecto.** `AuthService` arranca con el estado en `null`. El
  acceso a una ruta protegida escribiendo su URL directamente redirige siempre a
  `/login`, y la rehidratación de la sesión valida que el rol persistido coincida
  con el rol real de la cuenta, de modo que editar `localStorage` no permite
  escalar privilegios.
* **Contraseñas.** En el código **no** se almacena ninguna contraseña en claro,
  únicamente el hash derivado con *salt* y 1024 rondas de estiramiento. No
  obstante, se trata de una **simulación didáctica** (variante de FNV-1a): **no
  es bcrypt, Argon2 ni PBKDF2** y no debe considerarse criptográficamente
  segura. El prefijo `$2b$12$` se conserva solo para imitar el formato de
  almacenamiento típico de bcrypt.
* **Token.** El token emitido reproduce la estructura de un JWT
  (`header.payload.signature`) para poder ejercitar el `authInterceptor`, pero
  **no está firmado** ni es validado por un backend real.
* **Datos.** Todas las cuentas y registros son **sintéticos y anonimizados**: no
  corresponden a personas reales. Las credenciales de prueba se publican en este
  README por exigencia expresa del entregable.

En un sistema de producción, la verificación de contraseñas y la firma de tokens
deben residir **siempre en el servidor**; el cliente nunca debe validar
credenciales.
