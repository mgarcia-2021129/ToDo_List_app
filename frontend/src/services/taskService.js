// Capa de acceso a datos de tareas, adaptada al backend Django REST (/api/v1/).
//
// Esta capa es un adaptador delgado sobre el cliente generado por Orval
// (src/api/generated/endpoints.ts), que ya está tipado contra el schema real
// del backend. No se reimplementan llamadas HTTP a mano: se reutilizan las
// funciones generadas para no duplicar el contrato de la API.
//
// Notas sobre el contrato Django (ver Fase 6 - análisis):
// - No existe PUT: las actualizaciones son PATCH parciales (v1TasksPartialUpdate).
// - El listado devuelve un objeto paginado { count, next, previous, results };
//   aquí solo se extrae `results`. La paginación real de UI se implementará
//   en una fase posterior (fuera de alcance de 6.1).
// - Los objetos Task usan `id` (no `_id`) y `created_at` (no `createdAt`).
import {
  v1TasksList,
  v1TasksCreate,
  v1TasksPartialUpdate,
  v1TasksDestroy,
  v1TasksRestoreCreate,
  v1TasksReorderCreate,
} from "../api/generated/endpoints";

export const getTasks = async ({ completed, search, ordering, page } = {}) => {
  // Se arma el objeto de params a mano (en vez de pasar {completed, search,
  // ordering, page} tal cual) para no enviar claves con valor undefined/""
  // a Django: `search=` u `ordering=` vacíos son válidos para DRF, pero no
  // aportan nada y ensucian la URL/el log de peticiones.
  const params = {};
  if (completed !== undefined) params.completed = completed;
  if (search) params.search = search;
  if (ordering) params.ordering = ordering;
  if (page) params.page = page;

  const response = await v1TasksList(params);
  // 6.6: a diferencia de getTasks() antes de esta fase, ya no se descarta
  // el resto del sobre paginado. `count`/`next`/`previous` los necesita
  // useTasks para pintar los controles de paginación; `page_size` no se
  // expone porque el frontend no lo está eligiendo (se usa el default del
  // backend).
  const { count, next, previous, results } = response.data;
  return { count, next, previous, results };
};

export const getDeletedTasks = async () => {
  // `deleted=true` es el alias público de `is_deleted` que expone
  // TaskFilterSet en el backend (apps/tasks/filters.py). Igual que en
  // getTasks(), solo se consume la primera página.
  const response = await v1TasksList({ deleted: true });
  return response.data.results;
};

export const createTask = async (data) => {
  const response = await v1TasksCreate(data);
  return response.data;
};

export const updateTask = async (id, data) => {
  // PATCH parcial: el backend no expone PUT. Solo `title` y `completed`
  // son aceptados por el serializer de actualización.
  const response = await v1TasksPartialUpdate(id, data);
  return response.data;
};

export const deleteTask = async (id) => {
  // Nota: en Django esto es un soft delete (is_deleted=true), no una
  // eliminación física. El frontend lo trata como si desapareciera de la
  // lista activa; la UI de papelera/restauración (6.4) consume la tarea
  // por separado mediante getDeletedTasks().
  await v1TasksDestroy(id);
};

export const restoreTask = async (id) => {
  const response = await v1TasksRestoreCreate(id);
  return response.data;
};

export const reorderTasks = async (taskIds) => {
  // El backend (apps/tasks/services.py) exige el conjunto COMPLETO de IDs
  // de tareas activas del usuario, cada uno una única vez. La posición
  // final de cada tarea es su índice dentro de `taskIds`. No devuelve las
  // tareas reordenadas (200 sin cuerpo): el orden se refleja en el
  // frontend a partir del propio `taskIds` que se acaba de aceptar.
  await v1TasksReorderCreate({ task_ids: taskIds });
};