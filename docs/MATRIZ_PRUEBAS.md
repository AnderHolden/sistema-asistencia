# Matriz de Pruebas - Sistema de Gestión de Asistencia

**Proyecto:** Sistema de Gestión de Asistencia - Casita de Tareas  
**Versión:** 1.0  
**Ambiente:** Producción (Vercel + Google Firebase)  

---

## 1. Pruebas Funcionales por Módulo

| ID | Módulo | Caso de Prueba | Precondición | Pasos de Ejecución | Resultado Esperado | Estado |
|---|---|---|---|---|---|---|
| **CP-01** | Autenticación | Inicio de sesión exitoso | Usuario creado en Firebase Auth y perfil en `profiles` | 1. Ir a `/login`<br>2. Ingresar correo y contraseña válidos<br>3. Clic en **Iniciar Sesión** | Redirección a `/dashboard`, cookie `auth-session` activa y carga de menú según rol. | Aprobado |
| **CP-02** | Seguridad / Middleware | Acceso sin sesión a ruta privada | Navegador sin sesión activa | 1. Intentar acceder directamente a `/children` o `/dashboard` | El middleware intercepta y redirige automáticamente a `/login`. | Aprobado |
| **CP-03** | Control de Roles (RBAC) | Restricción de rutas administrativas a Operador | Sesión iniciada con rol `operator` | 1. Verificar menú lateral<br>2. Intentar navegar manualmente a `/users`, `/audit` o `/settings` | Las opciones administrativas no aparecen en el menú y el acceso directo muestra "Acceso restringido". | Aprobado |
| **CP-04** | Gestión de Niños | Registro y edición de niño | Sesión `super_admin` o autorizada | 1. Ir a `/children`<br>2. Clic en **Registrar Niño**<br>3. Completar datos y guardar | El niño se guarda en Firestore con código único, aparece en el directorio y se registra en `audit_logs`. | Aprobado |
| **CP-05** | Asistencia Niños | Toma de asistencia diaria | Niños activos registrados | 1. Ir a `/attendance/children`<br>2. Filtrar por grupo/jornada<br>3. Marcar **Asistió** / **No asistió** y guardar | Se registra la asistencia en `attendance_children` con fecha, estado y operador responsable. | Aprobado |
| **CP-06** | Asistencia Personal | Registro con firma digital táctil | Profesores/practicantes activos | 1. Ir a `/attendance/staff`<br>2. Seleccionar docente/practicante<br>3. Trazar firma en pantalla y confirmar | Se almacena la hora de entrada/salida y la imagen de la firma en Firebase Storage / Firestore. | Aprobado |
| **CP-07** | Correcciones | Solicitud por operador y aprobación por admin | Registro de asistencia previo | 1. Como `operator`, clic en **Reportar error** y enviar motivo<br>2. Como `super_admin`, ir a `/corrections` y aprobar | El registro muestra "En revisión", el admin aprueba en 1 clic, el estado se actualiza y se notifica al operador. | Aprobado |
| **CP-08** | Reportes | Filtro por rango de fechas y exportación PDF A4 | Registros de asistencia en rango | 1. Ir a `/reports`<br>2. Seleccionar vista **Por Fecha**, elegir niño y rango<br>3. Exportar a **PDF** y **Excel** | El reporte excluye fines de semana y festivos configurados; el PDF se genera en una sola hoja A4 legible. | Aprobado |
| **CP-09** | Certificados | Descarga de constancias PDF | Perfil institucional configurado en `/settings` | 1. Ir a `/certificates`<br>2. Elegir pestaña (Niños / Practicantes / Profesores)<br>3. Descargar PDF | Se genera el documento PDF con logo oficial, datos institucionales, firma y texto correspondiente. | Aprobado |
| **CP-10** | Auditoría | Registro inmutable de acciones | Cualquier operación CRUD o corrección | 1. Ir a `/audit` como `super_admin`<br>2. Filtrar por usuario o entidad | Se visualiza el historial cronológico con usuario, acción, entidad afectada y fecha/hora. | Aprobado |

---

## 2. Pruebas de Interfaz, Responsive y PWA

| ID | Área | Caso de Prueba | Pasos de Ejecución | Resultado Esperado | Estado |
|---|---|---|---|---|---|
| **CP-11** | Layout Escritorio | Barra lateral fija y scroll central | 1. Abrir en escritorio (`>= 1024px`)<br>2. Hacer scroll hacia abajo en una vista larga | La barra lateral izquierda permanece completamente fija; solo el lienzo central se desplaza. | Aprobado |
| **CP-12** | Responsive Móvil | Menú lateral colapsable | 1. Abrir en móvil (`< 1024px`)<br>2. Tocar botón hamburguesa y seleccionar opción | El menú se despliega como drawer sobre el contenido y se cierra al navegar o presionar `Esc`. | Aprobado |
| **CP-13** | Tema Visual | Cambio entre Modo Claro y Oscuro | 1. Clic en el botón sol/luna en la barra superior | La interfaz cambia de tema inmediatamente y persiste la preferencia en `localStorage`. | Aprobado |
| **CP-14** | PWA | Instalación como aplicación | 1. Abrir URL en Chrome/Edge o móvil<br>2. Seleccionar **Instalar aplicación** | La app se instala con el logo oficial de *Casita de Tareas* y ejecuta el Service Worker (`sw.js`). | Aprobado |

---

## 3. Pruebas Automatizadas / Verificación de Calidad de Código

| Verificación | Comando | Resultado |
|---|---|---|
| Compilación de tipos TypeScript | `npx tsc --noEmit` | Exitoso (0 errores) |
| Análisis estático ESLint | `npm run lint` | Exitoso (0 errores) |
