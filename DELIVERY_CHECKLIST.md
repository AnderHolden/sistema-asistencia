# Checklist de Entrega, Pruebas de Aceptación (UAT) y Mantenimiento — Casita de Tareas

Este documento sirve como guía de validación previa a la entrega formal del **Sistema de Gestión de Asistencia de Casita de Tareas** y como referencia de operación periódica para el Super Administrador.

---

## 1. Verificación Técnica Pre-Entrega

- [ ] **Variables de Entorno en Vercel configuradas:**
  - `NEXT_PUBLIC_FIREBASE_*` (6 variables de cliente Firebase)
  - `NEXT_PUBLIC_ADMIN_EMAIL` (correo del Super Administrador principal)
  - `FIREBASE_SERVICE_ACCOUNT` (JSON o Base64 de cuenta de servicio)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - `CRON_SECRET` (clave secreta para proteger los Cron Jobs de `vercel.json`)
- [ ] **Reglas de Seguridad publicadas en Firebase:**
  - Contenido de `firestore.rules` publicado en **Firestore Database > Reglas**.
  - Reglas de **Firebase Storage** publicadas y archivo `cors.json` aplicado al bucket.
- [ ] **Limpieza de datos de prueba:**
  - Verificar que no existan registros ficticios en `attendance_children`, `attendance_staff`, `correction_requests`, `correction_requests_children` ni usuarios de prueba en Firebase Authentication.
- [ ] **Verificación de Perfil Institucional:**
  - En **Configuración del Sistema**, validar nombre completo de la institución, NIT, dirección, ciudad, teléfono, correo, representante legal, cédula, cargo y firma digital (si aplica para certificados).

---

## 2. Pruebas de Aceptación con el Usuario (UAT)

| # | Módulo | Prueba a Realizar | Resultado Esperado | Cumple |
| :-: | :--- | :--- | :--- | :-: |
| 1 | **PWA y Marca** | Abrir la app en Chrome (PC y Android) e instalarla. | Se muestra el favicon y el ícono oficial de **Casita de Tareas** en la pantalla de inicio. | [ ] |
| 2 | **Autenticación y Roles** | Iniciar sesión como `super_admin` y como `operator`. | El operador no ve módulos administrativos (*Usuarios, Configuración, Auditoría, Grupos, Justificaciones, Historial*). | [ ] |
| 3 | **Directorio de Niños** | Crear/editar un niño y asignar grupo y código (`CT...`). | Se guarda en Firestore y aparece en el listado de asistencia del grupo correspondiente. | [ ] |
| 4 | **Asistencia Niños** | Marcar presentes y ausentes; luego enviar una justificación como operador. | La tarjeta muestra estado inmediato y al justificar muestra insignia **"En revisión"**. | [ ] |
| 5 | **Asistencia Personal** | Registrar entrada de profesor/practicante con firma táctil. | La firma se guarda correctamente y aparece en el historial/reporte del día. | [ ] |
| 6 | **Justificaciones** | Aprobar una solicitud pendiente desde **Justificaciones** como `super_admin`. | El estado se actualiza automáticamente en asistencia y llega notificación al operador. | [ ] |
| 7 | **Certificados y Constancias** | Generar vista previa y PDF para niño, practicante y profesor. | El PDF incluye logo, márgenes correctos sin desbordes y firma del representante legal. | [ ] |
| 8 | **Reportes por Fecha** | Ir a **Reportes Consolidados > Por Fecha**, elegir rango *Desde — Hasta* y un niño. | Muestra solo días de Lunes a Viernes (sin sábados, domingos ni festivos) y descarga PDF en 1 sola hoja con días asistidos/no asistidos y usuario generador (sin firma). | [ ] |
| 9 | **Exportación Excel / CSV** | Descargar reporte en Excel (`.xlsx`) y CSV. | Los archivos abren correctamente con columnas legibles y acentos intactos. | [ ] |
| 10 | **Correo SMTP** | Usar el botón **Probar envío de correo** en **Configuración**. | El correo de prueba llega a la bandeja de entrada sin errores. | [ ] |

---

## 3. Guía de Operación y Mantenimiento Anual

1. **Inicio de cada año calendario:**
   - Los festivos oficiales de Colombia (fijos, Ley Emiliani y Semana Santa) se calculan automáticamente en el sistema.
   - Si la institución tiene **jornadas pedagógicas, vacaciones colectivas o recesos institucionales** adicionales, registrarlos en **Configuración del Sistema > Días Festivos** para que no cuenten como inasistencias en Reportes ni Certificados.
2. **Gestión de personal y operadores:**
   - Crear nuevas cuentas desde **Gestión de Usuarios** y eliminar o cambiar contraseña de cuentas que ya no laboren en la institución.
3. **Respaldo de información:**
   - Descargar mensualmente un consolidado en **Excel (`.xlsx`)** desde **Reportes Consolidados** como respaldo administrativo local, adicional a la persistencia en Google Cloud Firestore.

---

## 4. Acta de Conformidad de Entrega

- **Proyecto:** Sistema de Gestión de Asistencia PWA — Casita de Tareas
- **Versión / Repositorio:** `AnderHolden/sistema-asistencia` (rama `main`)
- **Fecha de entrega:** ____ / ____ / 202__
- **Entregado por:** ___________________________
- **Recibido a satisfacción por (Casita de Tareas):** ___________________________
