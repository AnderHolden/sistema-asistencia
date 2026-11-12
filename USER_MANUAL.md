# Manual de Usuario — Sistema de Gestión de Asistencia (Casita de Tareas)

Bienvenido al **Sistema de Gestión de Asistencia de Casita de Tareas**. Esta guía explica cómo usar cada módulo de la plataforma desde computador, tablet o teléfono móvil.

---

## 1. Instalación como App (PWA)

El sistema puede instalarse en tu dispositivo con el ícono oficial de **Casita de Tareas**:

- **En Android (Chrome):**
  1. Abre el enlace del sistema en Google Chrome.
  2. Toca el menú de los tres puntos (`⋮`) y selecciona **"Instalar aplicación"** o **"Agregar a pantalla de inicio"**.
- **En iPhone / iPad (Safari):**
  1. Abre el enlace en Safari.
  2. Toca el botón **Compartir** (cuadrado con flecha hacia arriba) y elige **"Agregar a inicio"**.
- **En Computador (Chrome / Edge):**
  1. Haz clic en el ícono de **Instalar** que aparece a la derecha de la barra de direcciones.

---

## 2. Inicio de Sesión y Navegación

1. Ingresa tu **correo electrónico** y **contraseña**.
2. Presiona **"Iniciar Sesión"**.
3. En la barra superior verás tu rol (**Super Administrador** u **Operador**), la **campana de notificaciones** (avisos de justificaciones pendientes o resueltas) y el botón para cambiar entre **Modo Claro / Modo Oscuro**.

---

## 3. Dashboard (Panel Principal)

Al ingresar verás un resumen en tiempo real:
- Total de niños activos, profesores y practicantes.
- Asistencias e inasistencias registradas en el día actual.
- Gráfica mensual comparativa de los últimos meses y accesos rápidos.

---

## 4. Área Niños

### 4.1. Asistencia Niños
1. En el menú lateral haz clic en **Asistencia Niños**.
2. Filtra por grupo si lo deseas o busca por nombre / código (ej. `CT001`).
3. Marca cada niño como **Presente (Asistió)** o **Ausente (No asistió)**.
4. **Si eres Operador y cometiste un error después de guardar:** haz clic en el botón de **Justificar / Reportar error** junto al niño, indica el estado correcto y escribe el motivo. La tarjeta mostrará **"En revisión"** hasta que el Super Administrador la resuelva.

### 4.2. Directorio de Niños
1. Ve a **Directorio de Niños** para registrar nuevos estudiantes, editar sus datos (grupo, jornada, acudiente, documento, fecha de nacimiento, fotografía) o consultar su carnet identificativo (`CT001...`).
2. Puedes cambiar el estado a *Activo* o *Inactivo* sin perder su historial.

### 4.3. Grupos y Niveles *(Solo Super Administrador)*
- Permite crear, editar o eliminar salones/niveles (ej. *Caminadores*, *Párvulos*, *Infancia*) a los que se asignan los niños.

---

## 5. Talento Humano

### 5.1. Asistencia Personal
1. Ve a **Asistencia Personal**.
2. Selecciona si vas a registrar a un **Profesor** o **Practicante**.
3. Marca la asistencia y solicita la **firma digital en pantalla** (con el dedo en tablet/celular o con el ratón en PC).
4. Si un docente o practicante olvidó firmar o fue marcado por error, el operador puede enviar una solicitud de **Habilitar firma** o **Marcar presente** para aprobación del administrador.

### 5.2. Profesores y Practicantes
- Desde **Profesores** y **Practicantes** puedes registrar o actualizar datos personales, documento, correo, cargo/contrato (para profesores) o universidad, carrera, supervisor e intensidad horaria diaria (para practicantes).

---

## 6. Documentos y Reportes

### 6.1. Certificados y Constancias
1. Ve a **Certificados y Constancias**.
2. Elige el tipo de documento en las pestañas superiores:
   - **Niños:** Constancia de matrícula y asistencia por rango de fechas (calculada sobre días hábiles de lunes a viernes sin festivos).
   - **Practicantes:** Certificado de prácticas académicas con universidad, programa académico y periodo.
   - **Profesores:** Certificación laboral con cargo, tipo de contrato, fechas y salario (opcional).
3. Selecciona a la persona, ajusta las fechas o campos opcionales, haz clic en **Vista Previa** para revisar el PDF y luego en **Descargar PDF**.

### 6.2. Reportes Consolidados (y Reporte por Fecha Desde — Hasta)
En el módulo **Reportes Consolidados** puedes consultar tanto **Niños** como **Personal** en tres vistas:

1. **Consolidado:** Gráficas de tendencia mensual, gráfica circular del período y tabla resumen por estudiante o personal (con filtros *Hoy*, *Semana*, *Mes*, *Año* y *Rango personalizado*).
2. **Por Fecha (Rango Desde — Hasta por Niño/a):**
   - Selecciona **Fecha Desde** y **Fecha Hasta**.
   - El sistema evalúa **únicamente días de Lunes a Viernes**, excluyendo automáticamente sábados, domingos y festivos oficiales/institucionales.
   - Busca y selecciona al **Niño(a) / Estudiante** en el buscador (o haz clic en **"Ver días / PDF"** en la tabla).
   - Verás el resumen exacto de **Días Hábiles**, **Días que Asistió** (verde), **Días que No Asistió** (rojo) y **% de Asistencia**.
   - Haz clic en **"Descargar PDF (Días que Asistió y No Asistió)"** para obtener un documento en **una sola hoja** con el logo de Casita de Tareas, las fechas en que asistió y no asistió, y la constancia automática con tu nombre y rol de usuario (sin firma).
3. **Por Persona:** Búsqueda directa de una persona para consultar su historial dentro de un rango *Desde — Hasta* y exportar su PDF individual, Excel (`.xlsx`) o CSV.

### 6.3. Historial de Asistencia *(Solo Super Administrador)*
- Permite consultar, corregir o registrar asistencias de fechas anteriores de forma individual o masiva.

### 6.4. Justificaciones *(Solo Super Administrador)*
- Centraliza todas las solicitudes enviadas por los operadores (niños y personal).
- Permite **Aprobar** (aplicando el cambio automáticamente en la asistencia y habilitando firma si aplica) o **Rechazar** agregando una nota administrativa.

---

## 7. Administración *(Solo Super Administrador)*

- **Bitácora de Auditoría:** Consulta quién creó, modificó o eliminó registros, con fecha y detalle exacto.
- **Gestión de Usuarios:** Crea nuevas cuentas de acceso (`Operador` o `Super Administrador`) y gestiona usuarios existentes.
- **Configuración del Sistema:**
  - Actualiza los datos institucionales que aparecen en los certificados (nombre, NIT, eslogan, dirección, ciudad, representante legal y firma).
  - Configura horarios de jornada, credenciales de correo SMTP (con botón de prueba) y registra los **Días Festivos Institucionales** adicionales del año.
