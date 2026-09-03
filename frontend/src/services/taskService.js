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
} from "../api/generated/endpoints";

export const getTasks = async () => {
  const response = await v1TasksList();
  // El backend pagina el listado. Por ahora se consume solo la primera
  // página (`results`); no se implementa aún UI de paginación (fuera de
  // alcance de esta fase).
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
  // eliminación física. El frontend actual lo sigue tratando como si
  // desapareciera de la lista, que es el comportamiento visible correcto
  // para esta fase. La UI de restauración queda fuera de alcance de 6.1.
  await v1TasksDestroy(id);
};