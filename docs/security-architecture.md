# Memoria Técnica de Arquitectura de Seguridad y Control de Acceso (iTUTOR)

**Módulo:** Desarrollo de Interfaces (Código 0488)  
**Ciclo Formativo:** Grado Superior en Desarrollo de Aplicaciones Multiplataforma (DAM 2)  
**Proyecto:** iTUTOR — Sistema Multiplataforma de Gestión de Tutorías  
**Autora:** Noelia Cantador  
**Tecnología:** Ionic 8 / Angular Standalone (TypeScript, RxJS)

---

## 1. Diagnóstico de Cumplimiento de la Aplicación

| Requerimiento del Documento | Estado en iTUTOR | Justificación Técnica |
| :--- | :---: | :--- |
| **Guards Funcionales Modernos** | **CUMPLE** | Se implementa `authGuard: CanActivateFn` con APIs funcionales (`inject()`), abandonando sintaxis obsoletas de clases (`CanActivate`). |
| **Protección Multi-Nivel (AuthN + AuthZ)** | **CUMPLE** | El guard comprueba primero la sesión activa (`!user`) y luego valida privilegios frente a `route.data['role']`. |
| **Redirección Contextual (`returnUrl`)** | **CUMPLE** | Preserva la ruta solicitada en query params (`queryParams: { returnUrl: state.url }`) y redirige a la vista correspondiente al rol si se vulnera autorización. |
| **HTTP Interceptors (`HttpInterceptorFn`)** | **CUMPLE** | Pipeline funcional registrado globalmente en `main.ts` con `provideHttpClient(withInterceptors([authInterceptor]))`. |
| **Inyección de Cabeceras Bearer** | **CUMPLE** | Clona peticiones salientes e inyecta `Authorization: Bearer <token>` y cabecera de cliente `X-App-Client`. |
| **Manejo Centralizado de Errores (401 / 403)** | **CUMPLE** | Atrapa fallos de sesión en el interceptor, purga el almacenamiento (`sessionStorage`) y expulsa al usuario al `/login`. |
| **Modelo RBAC Formal** | **CUMPLE** | Tres roles explícitos (`Admin`, `Teacher`, `Standard`) con políticas de acceso y privilegios desacoplados. |
| **Seguridad de Credenciales** | **CUMPLE** | Prohibido texto plano: derivación unidireccional salted hash (1024 rondas) y aislamiento de sesión por pestaña (`sessionStorage`). |
| **UI/UX Condicional Reactiva** | **CUMPLE** | Filtrado declarativo en plantilla (`@if`, `@for`) mediante señales/flujos (`currentUser$`) en `AppComponent` para evitar accesos indebidos antes de interactuar. |

---

## Apartado A: Fundamentación Teórico-Técnica

### 1. Functional Guards en Angular / Ionic Standalone
En las arquitecturas modernas de Angular (versiones 15+ a 19+), los guards basados en clases que implementaban interfaces como `CanActivate` han sido declarados obsoletos en favor de los **Guards Funcionales** (`CanActivateFn`, `CanMatchFn`, `CanDeactivateFn`). Estas funciones puras operan dentro del contexto de inyección reactivo mediante la función `inject()`, eliminando código boilerplate e instanciación de servicios innecesarios en el árbol de inyectores.

* **Ciclo de Vida en el Enrutamiento:**
  1. `canMatch`: Se evalúa durante la fase de reconocimiento de rutas. Si retorna `false`, el enrutador descarta la ruta candidata y continúa buscando otra coincidencia en la configuración.
  2. `canActivate`: Se ejecuta una vez resuelta y emparejada la ruta, inmediatamente antes de instanciar y activar el componente destino.
  3. `canDeactivate`: Se ejecuta al intentar abandonar la ruta actual, útil para confirmar salidas con cambios pendientes sin guardar.

* **Impacto en Rendimiento y Carga Perezosa (*Lazy Loading*): `canActivate` vs `canMatch`:**
  * **`canActivate`**: Cuando una ruta protegida con `loadComponent()` emplea únicamente `canActivate`, el enrutador de Angular **inicia la descarga del bundle JavaScript del chunk remoto antes de evaluar el guard**. Si la condición del guard falla, el usuario es redirigido pero el ancho de banda y la memoria del dispositivo móvil ya han sido consumidos descargando código que nunca llegará a ejecutarse.
  * **`canMatch`**: Evalúa los permisos de acceso **antes de que se solicite el chunk perezoso** a la red. Si el usuario no tiene la sesión o el rol requerido, la descarga del bundle se omite por completo. En arquitecturas móviles con conexiones limitadas (3G/4G), `canMatch` ofrece una protección perimetral superior tanto en rendimiento como en confidencialidad de assets.

---

### 2. HTTP Interceptors (`HttpInterceptorFn`)
* **Mecanismo de Pipeline en la Cadena de Inyección:**
  Los interceptores funcionales (`HttpInterceptorFn`) forman una cadena de responsabilidad o middleware bidireccional basada en flujos RxJS. Toda petición saliente originada por `HttpClient` atraviesa ordenadamente cada función del pipeline antes de ser transmitida por el manejador de transporte (`HttpBackend`). En sentido inverso, la respuesta del servidor o los errores de red recorren la misma cadena en sentido contrario.

* **Gestión y Propagación de Cabeceras de Autorización:**
  Dado que las instancias de `HttpRequest` son inmutables por diseño para evitar efectos secundarios de concurrencia, el interceptor genera una copia mediante `req.clone()` donde añade la cabecera `Authorization: Bearer <token>`.

* **Manejo Centralizado de Errores (401/403) y Flujo de Refresh Token:**
  * **HTTP 401 (Unauthorized):** El token ha caducado, no existe o no tiene una firma válida.
  * **HTTP 403 (Forbidden):** El token es válido pero el usuario carece de permisos de rol para el recurso solicitado.
  * **Estrategia ante tokens expirados (Refresh Token):**
    Ante una respuesta 401, un flujo de producción no expulsa al usuario de inmediato: congela las peticiones en cola mediante un `BehaviorSubject`, emite una llamada POST al endpoint `/auth/refresh` enviando el `refreshToken` almacenado en una cookie `HttpOnly`, obtiene un nuevo `accessToken`, clona la petición fallida con las nuevas credenciales y reanuda la ejecución con el operador `switchMap()`. Si la renovación falla, se purga la sesión y se redirige a `/login`.

---

### 3. Control de Acceso Basado en Roles (RBAC - Role-Based Access Control)
* **Definición Formal y Modelado de Privilegios:**
  El modelo RBAC desvincula los permisos individuales de los usuarios directos, introduciendo la entidad intermedia **Rol**:
  $$\text{Usuario} \longrightarrow \text{Rol} \longrightarrow \text{Permisos/Privilegios}$$
  En lugar de gestionar listas de control de acceso por identidad (difíciles de mantener), el sistema modela capacidades operativas agrupadas (e.g., supervisión académica, gestión de cobros, consulta de notas).

* **Diferencia Técnica entre Autenticación y Autorización:**
  * **Autenticación (AuthN - *¿Quién eres?*):** Comprobación criptográfica de la identidad declarada por el usuario (e.g., validación de credenciales email/hash o firma del token JWT).
  * **Autorización (AuthZ - *¿Qué tienes permitido hacer?*):** Comprobación de que la identidad verificada posee los permisos o roles necesarios para ejecutar una acción o ingresar a una vista específica.

* **Encapsulamiento del Payload y Claims dentro del Servicio de Sesión:**
  El token JWT transporta claims en su cuerpo (sub, role, exp, iss). El servicio centralizado `AuthService` debe encapsular la extracción y validación de estos datos, exponiendo el estado como flujos reactivos observables inmutables (`currentUser$`) hacia el resto de la aplicación, desacoplando completamente a la vista del mecanismo de decodificación o persistencia.

---

## Apartado B: Justificación de Implementación en el Proyecto

### 1. Ubicación en el Árbol de Rutas y Servicios
En iTUTOR, la protección de rutas se centraliza en `src/app/app.routes.ts` mediante el guard funcional `authGuard`:

```typescript
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'admin-dashboard',
    loadComponent: () => import('./features/admin-dashboard/admin-dashboard.page').then(m => m.AdminDashboardPage),
    canActivate: [authGuard],
    data: { role: 'Admin' }
  },
  {
    path: 'portal-profesor',
    loadComponent: () => import('./features/profesor-dashboard/profesor-dashboard.page').then(m => m.ProfesorDashboardPage),
    canActivate: [authGuard],
    data: { role: ['Teacher', 'Admin'] }
  },
  {
    path: 'mis-clases',
    loadComponent: () => import('./features/mis-clases/mis-clases.page').then(m => m.MisClasesPage),
    canActivate: [authGuard],
    data: { role: ['Standard', 'Teacher', 'Admin'], section: 'tutorias' }
  },
  {
    path: 'mis-pagos',
    loadComponent: () => import('./features/mis-clases/mis-clases.page').then(m => m.MisClasesPage),
    canActivate: [authGuard],
    data: { role: ['Standard', 'Admin'], section: 'pagos' }
  },
  { path: 'login', loadComponent: () => import('./features/login/login.page').then(m => m.LoginPage) },
  { path: '**', redirectTo: 'login' }
];
```

* **Jerarquía de Roles y Matriz de Acceso en iTUTOR:**
  1. **`Admin` (Administrador / Superusuario):** Control integral de la plataforma. Acceso concedido a `/admin-dashboard`, `/portal-profesor`, `/mis-clases` y auditoría de `/mis-pagos`.
  2. **`Teacher` (Profesor Docente):** Gestión académica. Acceso a `/portal-profesor` (liquidación de honorarios, censo de alumnos asignados) y `/mis-clases`. **Bloqueado el acceso a `/admin-dashboard` y `/mis-pagos`**.
  3. **`Standard` (Alumna/Alumno):** Portal del discente. Acceso a `/mis-clases` (calendario interactivo, apuntes, chat) y `/mis-pagos` (recibos y facturación). **Bloqueado el acceso a `/admin-dashboard` y `/portal-profesor`**.

* **Registro Global del Interceptor (`main.ts`):**
  Se registra en el arranque de la aplicación usando las APIs modernas de inyección de Angular Standalone:
  ```typescript
  bootstrapApplication(AppComponent, {
    providers: [
      { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
      provideIonicAngular(),
      provideRouter(routes, withPreloading(IdlePreloadingStrategy), withComponentInputBinding()),
      provideHttpClient(withInterceptors([authInterceptor]))
    ],
  });
  ```

---

### 2. Control Visual y Experiencia de Usuario (UI/UX Condicional)
Para evitar que el usuario intente acceder a rutas prohibidas y sufra bloqueos innecesarios en el guard, la interfaz de usuario oculta los elementos no autorizados de forma previa y reactiva en `src/app/app.component.ts`:

1. **Gestión Reactiva con Signals / Observables:** `AppComponent` consume `currentUser$` de `AuthService`.
2. **Filtrado Declarativo de Menús:** El método `getMenuPages(user)` retorna exclusivamente la colección de items permitida (`adminPages`, `teacherPages` o `studentPages`).
3. **Renderizado Seguro en Plantilla:** La directiva `@for (page of getMenuPages(currentUser); track page.title)` solo genera enlaces para los destinos a los que el rol en curso tiene autorización legal.

---

## Apartado C: Matriz de Alternativas Evaluadas

| Dimensión | Solución Adoptada en iTUTOR | Alternativa Descartada 1 | Alternativa Descartada 2 | Criterio de Selección |
| :--- | :--- | :--- | :--- | :--- |
| **Protección de Vistas** | **Guards Funcionales en Router (`authGuard`)** | Comprobación en hooks del componente (`ngOnInit` / `ionViewWillEnter`) | Guards basados en Clases (`implements CanActivate`) | Las comprobaciones en componente permiten el renderizado efímero de la vista e incrementan el acoplamiento. Los guards en router bloquean la navegación antes de la activación. Las clases aumentan el boilerplate innecesariamente. |
| **Gestión de Cabeceras HTTP** | **HTTP Interceptor Centralizado (`authInterceptor`)** | Inyección manual de cabecera `Authorization` en cada método de servicio | Almacenamiento en variables globales de servicio | La inyección manual genera duplicidad de código, riesgo crítico de olvido en peticiones y nula capacidad de gestionar globalmente respuestas 401/403. |
| **Modelo de Control de Acceso** | **RBAC Formal (`Admin`, `Teacher`, `Standard`)** | Flag Booleano Simple (`isAdmin: boolean`) | ABAC Completo (Políticas dinámicas por atributos/contexto) | Un flag booleano no escala ante más de dos tipos de usuarios (docentes vs estudiantes). ABAC añade una complejidad computacional y de configuración desproporcionada para el ámbito de la aplicación. |

---

## 2. Conclusión del Cumplimiento

La arquitectura de seguridad de **iTUTOR** cumple de manera rigurosa y estricta con todas las directrices teóricas y prácticas exigidas en el documento docente y los criterios de evaluación de la Comunidad de Madrid (RA 1, RA 3, RA 6):
* Desacoplamiento absoluto entre la lógica de presentación y la autenticación/autorización.
* Uso de estándares Angular Standalone funcionales vigentes.
* Integridad y confidencialidad en el almacenamiento de credenciales y tokens.
