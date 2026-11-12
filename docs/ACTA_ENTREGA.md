# Acta de Entrega y Aceptación de Proyecto

**Fecha:** ____ de ______________ de 2026  
**Proyecto:** Sistema de Gestión de Asistencia - Institución Infantil *"Casita de Tareas"*  
**Repositorio:** `https://github.com/AnderHolden/sistema-asistencia`  
**URL de Producción (Vercel):** `____________________________________________`

---

## 1. Objeto del Acta

Hacer constar la entrega formal del software **Sistema de Gestión de Asistencia**, desarrollado como Plataforma Web Progresiva (PWA) para el control digital de asistencia de niños, personal docente y practicantes, generación de reportes, certificados y auditoría de operaciones.

---

## 2. Alcance y Entregables

Se hace entrega satisfactoria de los siguientes componentes:

- [x] **Aplicación Web y PWA en Producción:** Desplegada en **Vercel** con integración continua desde la rama `main`.
- [x] **Backend en la Nube (Google Firebase):** Configurado con Firebase Authentication, Cloud Firestore (con reglas de seguridad), Firebase Storage y Firebase Admin SDK.
- [x] **Módulos Funcionales Implementados:**
  - Autenticación y Control de Acceso por Roles (`super_admin` y `operator`).
  - Dashboard estadístico con gráficas en tiempo real.
  - Toma de asistencia diaria de niños por grupos y jornadas.
  - Toma de asistencia de personal docente y practicantes con firma digital táctil.
  - Flujo de solicitud, revisión y aprobación de correcciones con notificaciones.
  - Gestión de directorios (niños, profesores, practicantes, grupos y usuarios).
  - Generación de certificados y constancias en PDF.
  - Reportes consolidados y por rango de fechas (exportación a Excel `.xlsx` y PDF A4).
  - Bitácora de auditoría inmutable y configuración institucional (incluyendo días festivos).
  - Tareas programadas (Cron Jobs) para autocierre y reportes por correo SMTP.
- [x] **Documentación Técnica y de Usuario:**
  - `README.md` (Descripción general e instalación)
  - `USER_MANUAL.md` (Manual de usuario final)
  - `TECHNICAL_MANUAL.md` (Manual técnico y modelo de datos)
  - `DEPLOYMENT.md` (Guía de despliegue en Vercel y Firebase)
  - `SECURITY.md` (Política y controles de seguridad)
  - `docs/REQUERIMIENTOS.md` (Especificación de requerimientos)
  - `docs/MATRIZ_PRUEBAS.md` (Matriz de pruebas ejecutadas)

---

## 3. Equipo de Desarrollo (Entrega)

- **Líder del Proyecto:** Iván Andrés Urbano Rivera — Practicante / Desarrollador de Software
- **Equipo de Apoyo:**
  - Gissela Soraya Dueñas Madroñero — Practicante
  - Lizeth Vanessa Muñoz Erazo — Practicante
  - Jenedith Meliza Paz Maya — Practicante

---

## 4. Aceptación y Firmas

Con la firma de la presente acta, la parte receptora manifiesta recibir a satisfacción el sistema y su documentación correspondiente, habiendo verificado su funcionamiento en el entorno de producción.

| Entregado por (Líder del Proyecto) | Recibido por (Institución / Evaluador) |
|---|---|
| **Nombre:** Iván Andrés Urbano Rivera | **Nombre:** _______________________________ |
| **Rol:** Líder del Proyecto / Desarrollador | **Cargo:** _______________________________ |
| **Firma:** _______________________________ | **Firma:** _______________________________ |
| **Fecha:** _______________________________ | **Fecha:** _______________________________ |
