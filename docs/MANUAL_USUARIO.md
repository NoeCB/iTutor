# iTUTOR — Manual Oficial de Usuario Final

**Aplicación:** iTUTOR (PWA / Ionic 9 + Angular Standalone)  
**Módulo:** Desarrollo de Interfaces (Código: 0488)  
**Ciclo:** Grado Superior en Desarrollo de Aplicaciones Multiplataforma (DAM 2)  
**Autora:** Noelia Cantador Bosqued  
**Acceso Web en Producción:** [https://i-tutor-ten.vercel.app/portal-profesor](https://i-tutor-ten.vercel.app/portal-profesor)  

---

## 1. Introducción al Sistema
**iTUTOR** es una plataforma web progresiva (PWA) de gestión académica y económica de clases particulares y tutorías. El sistema cuenta con tres tipos de perfiles con permisos y pantallas completamente diferenciados:

1. **Administrador (Noelia Cantador):** Coordinación general, analítica financiera, censo de alumnos y nóminas de profesores.
2. **Profesor Docente (Dra. Elena Ramos):** Expediente docente, seguimiento de alumnos a su cargo, honorarios acumulados y descarga de liquidaciones oficiales.
3. **Alumna / Usuario Estándar (Paula García):** Calendario interactivo de clases particulares, descarga de apuntes por asignatura, historial de pagos y chat con docentes.

---

## 2. Credenciales Oficiales de Acceso para Pruebas

Para agilizar la evaluación, en la pantalla de inicio de sesión (`/login`) existen **chips de acceso rápido** que rellenan automáticamente los datos al pulsarlos:

| Rol en el Sistema | Correo Electrónico | Contraseña | Destino Inicial | Acceso Rápido |
| :--- | :--- | :--- | :--- | :---: |
| **Administrador** | `noeliacantador@itutor.es` | `noelia` | `/admin-dashboard` | Chip **Admin** |
| **Profesor Docente** | `elenaramos@itutor.es` | `elena` | `/portal-profesor` | Chip **Profesora** |
| **Alumna (Estándar)** | `paulagarcia@itutor.es` | `paula` | `/mis-clases` | Chip **Alumna** |

---

## 3. Guía Paso a Paso por Perfil de Usuario

### 3.1. Perfil Administrador (`noeliacantador@itutor.es`)
Al iniciar sesión como Administradora, accederás automáticamente al **Cuadro de Mando General** (`/admin-dashboard`):
* **Panel de KPIs:** En la parte superior verás 4 tarjetas con métricas clave:
  1. *Ingresos Globales:* Facturación total acumulada con variación porcentual.
  2. *Horas Impartidas:* Volumen de horas lectivas impartidas en el centro.
  3. *Profesores Activos:* Número de docentes en plantilla (10 profesores).
  4. *Tasa de Asistencia:* Porcentaje de clases confirmadas vs. canceladas.
* **Filtros Temporales y Gráficos:** Puedes pulsar en las pestañas temporales (*Todos, Septiembre, Octubre, Noviembre, Diciembre*) para que los gráficos interactivos de **Chart.js** se recalculen en tiempo real.
* **Descarga de Informes:**
  * Pulsa el botón **Exportar PDF** para generar en tu navegador un documento vectorial formal con franja corporativa y la relación de clases.
  * Pulsa el botón **Exportar CSV** para descargar la hoja de cálculo con codificación BOM UTF-8 compatible con Microsoft Excel.
* **Auditoría de Censo Académico:** En las pestañas *Listado de Profesores (10)* y *Listado de Alumnos (10)* dispones de tablas avanzadas con **buscador en tiempo real** para consultar matrículas, planes y tarifas horarias.

---

### 3.2. Perfil Profesor Docente (`elenaramos@itutor.es`)
Al entrar con el perfil docente, el sistema te redirige a tu **Portal del Profesor** (`/portal-profesor`):
* **Resumen de Actividad:** Visualiza tu expediente, materias impartidas (*Física y Matemáticas*) y tu tarifa horaria oficial.
* **Alumnos Asignados:** Revisa las tarjetas de los alumnos a tu cargo (e.g. Paula García) y las horas cursadas con cada uno.
* **Liquidación de Honorarios:** En la tarjeta superior verás el importe total ganado. Pulsa el botón **Descargar Certificado de Liquidación** para obtener el PDF oficial de nómina.
* **Calendario y Mensajería:** A través del menú lateral puedes acceder al calendario de tus clases y a la bandeja de mensajes con tus alumnos.

---

### 3.3. Perfil Alumna (`paulagarcia@itutor.es`)
Al entrar con el perfil de estudiante, accedes al portal de la alumna (`/mis-clases`):
* **Calendario Interactivo de Tutorías:**
  * En pantalla verás el calendario mensual. Los días con clase programada aparecen señalizados con un indicador visual.
  * **Haz clic sobre el día 10 de octubre:** Se abrirá el recuadro inferior con la tutoría de *Ecuaciones Diferenciales* impartida por la *Dra. Elena Ramos*.
* **Facturación & Pagos (`/mis-pagos`):**
  * Consulta el desglose de mensualidades pagadas y pendientes.
  * Pulsa en cualquier recibo para descargar el **justificante oficial de pago en PDF**.
* **Mis Apuntes (`/mis-apuntes`):**
  * Filtra los documentos por asignatura y descarga los archivos de estudio en formato PDF.
* **Mensajes con Profesores (`/mensajes-profesores`):**
  * Envía mensajes directos a tus profesores para resolver dudas académicas.

---

## 4. Cierre de Sesión Seguro
Para salir de la aplicación o cambiar de perfil, abre el menú lateral izquierdo y haz clic en **Cerrar Sesión**. El sistema purgará el almacenamiento local y de sesión (`sessionStorage`), revocando el token JWT y devolviéndote a la pantalla de login.
