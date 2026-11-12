# Especificación de Requerimientos del Sistema (SRS)

**Proyecto:** Sistema de Gestión de Asistencia - Casita de Tareas  
**Versión:** 1.0  

---

## 1. Propósito y Alcance

El **Sistema de Gestión de Asistencia** tiene como objetivo digitalizar, centralizar y automatizar el control diario de asistencia de los niños matriculados, profesores y practicantes de la institución infantil *"Casita de Tareas"*, reemplazando las planillas físicas por una plataforma web progresiva (PWA) accesible desde dispositivos móviles y computadoras, con trazabilidad completa, reportes y generación de certificados.

---

## 2. Actores y Roles del Sistema

| Rol | Descripción |
|---|---|
| **Super Administrador (`super_admin`)** | Control total del sistema: gestión de usuarios y roles, configuración institucional y festivos, grupos, aprobación/rechazo de correcciones, edición directa/histórica y acceso a la bitácora de auditoría. |
| **Operador (`operator`)** | Personal encargado de la operación diaria: registro de asistencia de niños y personal, consulta de directorios, generación de reportes/certificados y envío de solicitudes de corrección justificadas. |
| **Sistema (Cron Jobs)** | Procesos automatizados encargados del autocierre diario de inasistencias y envío de notificaciones/resúmenes por correo electrónico. |

---

## 3. Requerimientos Funcionales (RF)

| Código | Nombre | Descripción |
|---|---|---|
| **RF-01** | Autenticación y Sesión | El sistema debe permitir el inicio y cierre de sesión seguro mediante correo electrónico y contraseña, protegiendo todas las rutas privadas mediante middleware. |
| **RF-02** | Control de Acceso (RBAC) | El sistema debe restringir las vistas, acciones y colecciones según el rol del usuario (`super_admin` u `operator`). |
| **RF-03** | Gestión de Niños y Grupos | El sistema debe permitir registrar, consultar, editar e inactivar niños matriculados, asociándolos a grupos/niveles, jornadas y datos de acudientes. |
| **RF-04** | Gestión de Talento Humano | El sistema debe permitir administrar el directorio de profesores y practicantes (datos de contacto, documento, universidad/carrera, estado y fechas). |
| **RF-05** | Asistencia Diaria de Niños | El sistema debe permitir marcar diariamente a los niños como **Presente** o **Ausente**, filtrando por grupo y jornada. |
| **RF-06** | Asistencia de Personal con Firma | El sistema debe permitir registrar la entrada y salida de profesores y practicantes capturando su **firma digital táctil** directamente en pantalla. |
| **RF-07** | Flujo de Correcciones | Los operadores deben poder solicitar correcciones justificadas cuando exista un error de marcación; los administradores deben poder aprobarlas, reiniciar el registro o rechazarlas con nota explicativa. |
| **RF-08** | Notificaciones | El sistema debe mostrar notificaciones en tiempo real en la barra superior (campana) y enviar correos SMTP ante correcciones, inasistencias o autocierres. |
| **RF-09** | Dashboard y Estadísticas | El sistema debe mostrar métricas consolidadas (totales activos, asistencia del mes y gráficas comparativas) al iniciar sesión. |
| **RF-10** | Reportes y Exportación | El sistema debe generar reportes consolidados y por rango de fechas por niño (excluyendo fines de semana y festivos), permitiendo exportar a **Excel (`.xlsx`)** y **PDF (A4)**. |
| **RF-11** | Certificados y Constancias | El sistema debe generar constancias de asistencia para niños, constancias de práctica y certificados laborales en formato PDF con logo y firma institucional. |
| **RF-12** | Auditoría y Configuración | El sistema debe registrar todas las operaciones críticas en una bitácora inmutable (`audit_logs`) y permitir configurar datos institucionales, horarios y festivos. |

---

## 4. Requerimientos No Funcionales (RNF)

| Código | Categoría | Descripción |
|---|---|---|
| **RNF-01** | Usabilidad / Interfaz | La interfaz debe ser responsiva, contar con modo claro/oscuro, y mantener la barra lateral de navegación fija en escritorio con desplazamiento independiente en el área central. |
| **RNF-02** | Portabilidad (PWA) | La aplicación debe ser instalable como Progressive Web App (PWA) en Android, iOS y escritorio mediante manifiesto web y Service Worker. |
| **RNF-03** | Seguridad | Toda comunicación debe viajar por HTTPS, los secretos deben residir únicamente en variables de entorno del servidor y las operaciones de base de datos deben estar protegidas por `firestore.rules`. |
| **RNF-04** | Rendimiento | La carga de catálogos, perfiles y gráficas debe optimizarse mediante caché de sesión e importación dinámica de librerías pesadas (gráficas y generación de PDF). |
| **RNF-05** | Disponibilidad y Despliegue | El sistema debe desplegarse en infraestructura serverless (Vercel + Google Firebase) con integración continua desde la rama `main` de GitHub. |
| **RNF-06** | Mantenibilidad | El código debe estar tipado estrictamente con TypeScript, seguir las reglas de ESLint y contar con documentación técnica, de usuario y de despliegue actualizada. |
