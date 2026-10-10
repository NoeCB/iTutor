# iTutor (TutorFlow) — Plataforma de Gestión Académica

Aplicación híbrida multiplataforma desarrollada con **Ionic + Angular (Standalone Components)** y **Capacitor** para la gestión académica, control de sesiones de tutoría y análisis financiero de alumnos y profesores.

## Características Principales

- **Autenticación y Control de Acceso por Roles**: Servicio reactivo con `BehaviorSubject`, persistencia de sesión y protección de rutas mediante `CanActivateFn` (`authGuard`) diferenciando perfiles `Admin` y `Standard`.
- **Formulario Reactivo con Validación Asíncrona**: Validación en tiempo real de credenciales y comprobación asíncrona de disponibilidad de correo electrónico simulando latencia de red.
- **Orquestación Concurrente de Datos (`forkJoin`)**: Integración simultánea de fuentes relacionales (catálogo SQL de alumnos y tarifas) y documentales (sesiones NoSQL en MongoDB).
- **Dashboard Analítico en Tiempo Real**: Visualización de KPIs e indicadores con `ChangeDetectionStrategy.OnPush` y gráficas dinámicas mediante **Chart.js**.
- **Exportación de Informes Profesionales**: Generación de archivos CSV (codificación UTF-8 con BOM para Excel) e informes ejecutivos en PDF mediante **jsPDF** y **jspdf-autotable**.
- **Despliegue Multiplataforma**: Preparado como PWA/Web y empaquetado nativo para **Android** con Capacitor.

## Estructura del Flujo de Trabajo (Gitflow)

El repositorio sigue un flujo de trabajo estructurado en ramas:

- `main`: Rama principal con el código estable listo para producción.
- `develop`: Rama de integración donde convergen las distintas funcionalidades.
- `feature/autenticacion-y-guards`: Gestión de sesión, `authGuard` y pantalla de login reactivo.
- `feature/componentes-compartidos`: Componentes reutilizables (`stat-card` y `data-table`).
- `feature/dashboard-y-datos`: Servicio de datos concurrente (`forkJoin`) y panel de administración con gráficas y exportación.
- `feature/navegacion-y-estilos`: Menú lateral adaptativo (`IonSplitPane`), enrutado lazy-loading y tema visual.
- `feature/despliegue-android`: Integración de la plataforma nativa Android con Capacitor y documentación.

## Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo
npm start

# Compilar artefacto de producción web
npm run build -- --configuration production

# Sincronizar con la plataforma Android
npx cap sync android
```
