# Manual de Usuario - Sistema de Gestión de Asistencia

## Guia de Inicio Rápido

### Instalación como Aplicación (PWA)

#### Desde el teléfono móvil:
1. Abre Chrome/Safari y ve a la URL del sistema
2. Toca el botón "Compartir" (iOS) o "Instalar" (Android)
3. Selecciona "Agregar a pantalla de inicio"
4. La app aparecerá en tu pantalla de inicio

#### Desde computador:
1. Abre Chrome y ve a la URL del sistema
2. Haz clic en el ícono de instalar en la barra de direcciones
3. Confirma la instalación

---

## Módulo de Login

1. Ingresa tu **correo electrónico** y **contraseña**
2. Haz clic en "Iniciar Sesión"
3. Serás redirigido al Dashboard

> Si olvidaste tu contraseña, contacta al Super Administrador.

---

## Dashboard

Al iniciar sesión, verás un resumen con:
- **Total de niños registrados**
- **Total de profesores**
- **Total de practicantes**
- **Asistencias del día** (presentes y ausentes)
- **Gráfica de asistencia mensual**

---

## Gestión de Niños

### Registrar un niño nuevo
1. Ve a **Niños** en el menú lateral
2. Haz clic en "Registrar Niño"
3. Completa los campos:
   - Nombres y apellidos
   - Documento (opcional)
   - Fecha de nacimiento
   - Grupo
   - Jornada (Mañana / Tarde / Completa)
   - Estado (Activo / Inactivo)
   - Observaciones
4. Haz clic en "Registrar"

### Editar un niño
1. Haz clic en el ícono de lápiz (✏️) en la tarjeta del niño
2. Modifica los campos necesarios
3. Haz clic en "Actualizar"

### Eliminar un niño
1. Haz clic en el ícono de papelera (🗑️)
2. Confirma la eliminación

---

## Gestión de Grupos

### Crear un grupo
1. Ve a **Grupos** en el menú
2. Haz clic en "Crear Grupo"
3. Escribe el nombre (Ej: Caminadores, Párvulos)
4. Agrega una descripción (opcional)
5. Haz clic en "Crear"

---

## Gestión de Profesores

1. Ve a **Profesores** en el menú
2. Haz clic en "Registrar Profesor"
3. Completa la información
4. Haz clic en "Registrar"

---

## Gestión de Practicantes

1. Ve a **Practicantes** en el menú
2. Haz clic en "Registrar Practicante"
3. Completa la información
4. Haz clic en "Registrar"

---

## Registro de Asistencia de Niños

### Pasos:
1. Ve a **Asistencia** en el menú
2. Se mostrará la fecha y hora actuales
3. Verás la lista de todos los niños activos
4. Para cada niño, selecciona:
   - **Asistió** (verde) - si el niño está presente
   - **No asistió** (rojo) - si el niño no vino
5. Puedes filtrar por grupo usando los botones superiores
6. Cuando termines, haz clic en **"Guardar Asistencia"**

### Importante:
- Cada niño se marca como **Asistió** o **No asistió** de forma inmediata.
- Si un operador comete una equivocación al marcar, puede hacer clic en el ícono de alerta ⚠️ (**Reportar error**) para enviar una solicitud de corrección al Administrador indicando el estado correcto y el motivo.
- Mientras la solicitud esté en proceso, la tarjeta mostrará la insignia animada **"En revisión"** para prevenir duplicados.
- El Super Administrador puede corregir asistencias directamente o gestionar las solicitudes desde el módulo de **Correcciones**.

---

## Módulo de Correcciones (Para Operadores y Administradores)

### Para Operadores:
1. Si registraste erróneamente a un niño o miembro del personal, haz clic en el botón de corrección junto a su estado.
2. Selecciona a qué estado deseas cambiar (**Asistió** o **No asistió**) o qué acción requieres (**Habilitar firma** o **Marcar presente**).
3. Escribe una breve justificación del error y haz clic en **Enviar Solicitud**.
4. La interfaz te notificará automáticamente cuando el Administrador apruebe o rechace tu solicitud.

### Para Administradores (/corrections):
1. Ingresa a **Correcciones** en el menú de navegación.
2. Verás dos pestañas: **Asistencia de Niños** y **Personal Docente**.
3. En la vista de **Pendientes**, puedes:
   - **Aprobar y Cambiar Estado:** Aplica la corrección inmediatamente en 1 clic sin borrar el registro.
   - **Reiniciar Registro:** Elimina el registro para que el operador vuelva a marcar desde cero.
   - **Rechazar:** Rechaza la solicitud indicando una nota explicativa para el operador.
4. Consulta el **Historial** para revisar todas las solicitudes resueltas anteriormente.

---

## Reportes

### Ver reportes:
1. Ve a **Reportes** en el menú
2. Selecciona el período:
   - Día / Semana / Mes / Año
3. Filtra por grupo si lo deseas
4. Verás:
   - Gráfica de tendencia mensual
   - Gráfica de distribución (presentes vs ausentes)
   - Tabla detallada por niño

### Exportar datos:
- **Excel**: Haz clic en "Excel" para descargar archivo .xlsx
- **PDF**: Haz clic en "PDF" para descargar reporte formateado

---

## Auditoría (Solo Super Admin)

1. Ve a **Auditoría** en el menú
2. Verás un registro cronológico de todas las acciones:
   - Quién realizó la acción
   - Qué acción realizó
   - A qué entidad afectó
   - Fecha y hora exacta
3. Puedes filtrar por usuario, acción o entidad

---

## Gestión de Usuarios (Solo Super Admin)

### Crear usuario:
1. Ve a **Usuarios** en el menú
2. Haz clic en "Crear Usuario"
3. Completa nombre, correo, contraseña y rol
4. Haz clic en "Crear"

### Restablecer contraseña:
1. Haz clic en "Restablecer Contraseña"
2. Ingresa el correo del usuario
3. Se enviará un correo de restablecimiento

---

## Configuración (Solo Super Admin)

1. Ve a **Configuración** en el menú
2. Modifica los datos de la institución
3. Configura horarios de jornadas
4. Haz clic en "Guardar Configuración"

---

## Modo Claro / Oscuro

Haz clic en el ícono de sol/luna (☀️/🌙) en la esquina superior derecha para cambiar entre modo claro y oscuro.

---

## Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl + K` | Buscar |
| `Esc` | Cerrar modales |

---

## Solución de Problemas

| Problema | Solución |
|----------|----------|
| No puedo iniciar sesión | Verifica correo y contraseña. Contacta al admin. |
| No guardó la asistencia | Verifica tu conexión a internet |
| No se ven los datos | Recarga la página (F5) |
| La app va lenta | Limpia la caché del navegador |

---

## Soporte

Si necesitas ayuda adicional, contacta al Super Administrador del sistema.