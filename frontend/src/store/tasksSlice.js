import { createAsyncThunk, createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import {
    getTasks,
    getDeletedTasks,
    createTask as createTaskApi,
    deleteTask as deleteTaskApi,
    updateTask as updateTaskApi,
    restoreTask as restoreTaskApi,
    reorderTasks as reorderTasksApi,
} from "../services/taskService";

// Extrae un mensaje de error legible de una respuesta de DRF. Idéntica a la
// usada en la versión Zustand (useTaskStore.js): mismo contrato de backend,
// mismo criterio de fallback.
const extractErrorMessage = (err, fallback) => {
    const data = err?.response?.data;
    if (!data) return fallback;
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
        const value = data[firstKey];
        return Array.isArray(value) ? value[0] : String(value);
    }
    return fallback;
};

// Entity adapter SOLO para tareas activas. Sin `sortComparer`: el orden de
// `state.ids` es el que llega de Django (o el que se reconstruye a mano tras
// un reorder), igual que el array plano de la versión Zustand — no se le
// pide al adapter que ordene nada por su cuenta.
//
// La papelera NO se normaliza: es un array simple (`trashTasks`), igual que
// en Zustand. No tiene mutación optimista que aislar por entidad, así que
// normalizarla no aportaría nada y sería una abstracción de más.
const tasksAdapter = createEntityAdapter();

// Aislado en una función (en vez de un objeto compartido) para que
// `reset` pueda producir un estado inicial fresco cada vez, sin reutilizar
// una referencia ya congelada por Immer en un reset anterior.
//
// IMPORTANTE: igual que en la versión Zustand, el store de Redux también es
// un singleton de módulo (se crea una única vez en main.jsx). Sin este
// `reset`, un logout seguido de un nuevo login arrastraría filtros, página
// y papelera de la sesión anterior — comportamiento que ya se corrigió en
// la versión Zustand (ver `reset` en useTaskStore.js) y que aquí se
// reproduce igual, no es una funcionalidad nueva.
const createInitialState = () =>
    tasksAdapter.getInitialState({
        // --- Query server-side: completed / search / ordering ---
        completedFilter: undefined,
        // Valor YA debounced, el que se envía al backend. El valor "en vivo"
        // que teclea el usuario vive fuera del store, en useDebouncedSearch.
        search: "",
        ordering: "",

        // --- Paginación ---
        page: 1,
        count: 0,
        next: null,
        previous: null,

        // --- Tareas activas ---
        loading: true,
        error: null,

        // --- Papelera ---
        trashTasks: [],
        trashLoading: false,
        trashError: null,
    });

// `silent`: usado por toggleStatus para revalidar tras un PATCH ya exitoso
// cuando la tarea sale de la vista actual. No toca `loading` ni, en caso de
// fallo, `error` — ver extraReducers más abajo. Idéntico contrato que en
// useTaskStore.js.
export const loadTasks = createAsyncThunk(
    "tasks/loadTasks",
    async ({ silent = false } = {}, { getState, dispatch, rejectWithValue }) => {
        const state = getState().tasks;
        const params = {
            completed: state.completedFilter,
            search: state.search,
            ordering: state.ordering,
            page: state.page,
        };

        try {
            const data = await getTasks(params);
            return { data, silent };
        } catch (err) {
            const requestedPage = params.page ?? 1;
            // Mismo backoff de página inválida (404) que en useTaskStore.js,
            // reproducido tal cual, incluyendo el mismo comportamiento de
            // carrera: el re-dispatch de abajo NO se espera (no hay await),
            // igual que en Zustand `get().loadTasks()` se llama sin await
            // dentro del catch. Esto es intencional para mantener el mismo
            // comportamiento observable en el caso límite de una página
            // inválida (p.ej. loading puede parpadear a false mientras el
            // refetch corregido sigue en curso) — no es un bug introducido
            // aquí, es el mismo comportamiento que ya tiene la versión
            // Zustand y que esta migración no debe "arreglar".
            if (err?.response?.status === 404 && requestedPage > 1) {
                dispatch(pageChanged(requestedPage - 1));
                dispatch(loadTasks({}));
                return rejectWithValue({ handled: true, silent });
            }
            if (!silent) {
                return rejectWithValue({
                    message: extractErrorMessage(err, "No se pudieron cargar las tareas."),
                    silent,
                });
            }
            return rejectWithValue({ handled: true, silent });
        }
    }
);

export const loadTrash = createAsyncThunk(
    "tasks/loadTrash",
    async (_, { rejectWithValue }) => {
        try {
            return await getDeletedTasks();
        } catch (err) {
            return rejectWithValue(extractErrorMessage(err, "No se pudo cargar la papelera."));
        }
    }
);

export const addTask = createAsyncThunk(
    "tasks/addTask",
    async (data, { dispatch, rejectWithValue }) => {
        try {
            await createTaskApi(data);
            // La tarea nueva puede no pertenecer a la vista actual (p.ej. si
            // hay un filtro `completed=true` activo y se crea una tarea
            // incompleta, o si no coincide con la búsqueda). Igual que en
            // Zustand, se refresca la consulta actual en vez de asumir dónde
            // debería insertarse localmente.
            await dispatch(loadTasks({}));
            return null;
        } catch (err) {
            // Se usa rejectWithValue (no un throw sin capturar) para que
            // App.jsx pueda seguir usando `dispatch(addTask(data)).unwrap()`
            // dentro de su propio try/catch, igual que hoy hace
            // `await addTask(data)` con el `throw err` de useTaskStore.js.
            return rejectWithValue(extractErrorMessage(err, "No se pudo crear la tarea."));
        }
    }
);

export const updateTask = createAsyncThunk(
    "tasks/updateTask",
    async ({ id, data }, { dispatch, rejectWithValue }) => {
        try {
            await updateTaskApi(id, data);
            // Editar el título o el estado puede sacar a la tarea de la
            // vista actual (deja de matchear `search`, o de cumplir el
            // filtro `completed`). Se refresca por la misma razón que en
            // addTask.
            await dispatch(loadTasks({}));
            return null;
        } catch (err) {
            return rejectWithValue(extractErrorMessage(err, "No se pudo actualizar la tarea."));
        }
    }
);

export const deleteTask = createAsyncThunk(
    "tasks/deleteTask",
    async (id, { dispatch, rejectWithValue }) => {
        try {
            await deleteTaskApi(id);
            // Igual que en Zustand: count/next/previous dependen de cuántas
            // tareas activas quedan, así que se refresca la consulta actual
            // en vez de solo quitar la tarea del array local.
            await dispatch(loadTasks({}));
            return null;
        } catch (err) {
            // No se usa `.unwrap()` desde el componente para esta acción
            // (igual que en Zustand, donde deleteTask no relanza): el error
            // queda expuesto solo vía el banner de `error`.
            return rejectWithValue(extractErrorMessage(err, "No se pudo eliminar la tarea."));
        }
    }
);

// --- Toggle optimista (completar/descompletar) ---
//
// Traducción de `toggleStatus` de useTaskStore.js. La diferencia
// ESTRUCTURAL (acordada) frente a Zustand: con estado normalizado no existe
// "el array completo" para snapshotear/restaurar de una sola vez, así que
// el rollback opera sobre la entidad puntual (snapshot de esa tarea) más
// `count`, en vez de un snapshot de `tasks` entero. El comportamiento
// funcional es el mismo: en el flujo normal (una tarea a la vez, que es el
// único flujo que la UI permite hoy) el resultado observable es idéntico.
// No se agrega `togglingIds` ni ninguna protección contra doble-click o
// carreras que no exista ya en la versión Zustand: un doble click aquí
// dispara dos PATCH en paralelo, igual que hoy.
export const toggleStatus = createAsyncThunk(
    "tasks/toggleStatus",
    async (id, { getState, dispatch, rejectWithValue }) => {
        const state = getState().tasks;
        const task = state.entities[id];
        if (!task) {
            // No debería ocurrir en el flujo normal de la UI (solo se llama
            // sobre una tarea visible en `tasks`), pero se cubre por
            // completitud en vez de lanzar un error de runtime.
            return rejectWithValue({ message: "La tarea ya no existe." });
        }

        const previousTask = task;

        const newCompleted = !task.completed;
        const staysInCurrentView =
            state.completedFilter === undefined || state.completedFilter === newCompleted;

        // Aplica el cambio optimista de inmediato (antes del await), igual
        // que en Zustand: se ejecuta síncronamente en el mismo tick en que
        // se llama a esta acción.
        dispatch(
            taskToggledOptimistic({
                id,
                completed: newCompleted,
                removedFromView: !staysInCurrentView,
            })
        );

        try {
            await updateTaskApi(id, { completed: newCompleted });
            // Igual que en Zustand: si la tarea salió de la vista actual, se
            // revalida en silencio la consulta vigente para resincronizar
            // count/next/previous. Se espera (await) igual que
            // `await loadTasks(currentParams, {silent:true})` en Zustand.
            if (!staysInCurrentView) {
                await dispatch(loadTasks({ silent: true }));
            }
            return { id };
        } catch (err) {
            // Rollback SOLO de esta entidad (y, de forma RELATIVA, de
            // `count` si había sido removida de la vista) — nunca del
            // slice completo ni de un `count` absoluto, para no pisar el
            // cambio optimista de otra tarea distinta que esté en vuelo al
            // mismo tiempo. Ver `taskToggleRolledBack`.
            dispatch(
                taskToggleRolledBack({
                    task: previousTask,
                    removedFromView: !staysInCurrentView,
                })
            );
            return rejectWithValue({
                message: extractErrorMessage(err, "No se pudo actualizar el estado de la tarea."),
            });
        }
    }
);

export const restoreTask = createAsyncThunk(
    "tasks/restoreTask",
    async (id, { dispatch, rejectWithValue }) => {
        try {
            await restoreTaskApi(id);
            dispatch(taskRemovedFromTrash(id));
            // El backend conserva la posición original de la tarea
            // restaurada. Igual que en Zustand, se refresca el listado
            // activo en vez de adivinar dónde insertarla localmente.
            await dispatch(loadTasks({}));
            return null;
        } catch (err) {
            // No se relanza (igual que en Zustand): el error queda visible
            // vía `trashError`, independiente del `error` de tareas activas.
            return rejectWithValue(extractErrorMessage(err, "No se pudo restaurar la tarea."));
        }
    }
);

export const reorderTo = createAsyncThunk(
    "tasks/reorderTo",
    async (orderedIds, { rejectWithValue }) => {
        try {
            await reorderTasksApi(orderedIds);
            // El endpoint no devuelve las tareas reordenadas (200 sin
            // cuerpo): el nuevo orden se reconstruye a partir del propio
            // `orderedIds` ya aceptado por el backend, igual que en Zustand.
            return orderedIds;
        } catch (err) {
            return rejectWithValue(extractErrorMessage(err, "No se pudo reordenar las tareas."));
        }
    }
);

// Mueve una tarea activa una posición hacia arriba o abajo. Se mantiene
// como función plana (no createAsyncThunk) porque no hace ninguna llamada
// HTTP propia — solo calcula el nuevo orden y delega en `reorderTo`, igual
// que en useTaskStore.js.
export const moveTask = (taskId, direction) => (dispatch, getState) => {
    const { ids } = getState().tasks;
    const index = ids.indexOf(taskId);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ids.length) return;

    const reordered = [...ids];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    dispatch(reorderTo(reordered));
};

// setCompletedFilter / setOrdering / setSearch: en Zustand cada una hacía
// un `set(...)` síncrono seguido de `get().loadTasks()` explícito. Aquí es
// la misma idea con dos dispatches (reducer síncrono + thunk), sin
// envolverlos en un thunk combinado con nombre nuevo.
export const setCompletedFilter = (value) => (dispatch) => {
    dispatch(completedFilterChanged(value));
    dispatch(pageChanged(1));
    dispatch(loadTasks({}));
};

export const setOrdering = (value) => (dispatch) => {
    dispatch(orderingChanged(value));
    dispatch(pageChanged(1));
    dispatch(loadTasks({}));
};

// Recibe el valor YA debounced (llamado desde useDebouncedSearch tras
// 400ms sin cambios), igual que `setSearch` en useTaskStore.js.
export const setSearch = (value) => (dispatch) => {
    dispatch(searchChanged(value));
    dispatch(pageChanged(1));
    dispatch(loadTasks({}));
};

// Solo avanzan si el backend efectivamente indicó next/previous, igual que
// en Zustand.
export const goToNextPage = () => (dispatch, getState) => {
    const { next, page } = getState().tasks;
    if (next) {
        dispatch(pageChanged(page + 1));
        dispatch(loadTasks({}));
    }
};

export const goToPreviousPage = () => (dispatch, getState) => {
    const { previous, page } = getState().tasks;
    if (previous) {
        dispatch(pageChanged(Math.max(1, page - 1)));
        dispatch(loadTasks({}));
    }
};

const tasksSlice = createSlice({
    name: "tasks",
    initialState: createInitialState(),
    reducers: {
        // Reinicia todo el slice a su estado inicial. Ver comentario junto a
        // `createInitialState` sobre por qué existe (paridad con Zustand).
        reset: () => createInitialState(),

        pageChanged(state, action) {
            state.page = action.payload;
        },
        completedFilterChanged(state, action) {
            state.completedFilter = action.payload;
        },
        orderingChanged(state, action) {
            state.ordering = action.payload;
        },
        searchChanged(state, action) {
            state.search = action.payload;
        },

        // --- Acciones internas de apoyo al toggle optimista ---
        taskToggledOptimistic(state, action) {
            const { id, completed, removedFromView } = action.payload;
            if (removedFromView) {
                tasksAdapter.removeOne(state, id);
                state.count = Math.max(0, state.count - 1);
            } else {
                tasksAdapter.updateOne(state, { id, changes: { completed } });
            }
        },
        taskToggleRolledBack(state, action) {
            const { task, removedFromView } = action.payload;
            // `upsertOne` cubre ambos casos: si la tarea seguía en `tasks`
            // (solo se le revierte `completed`) o si había sido removida de
            // la vista (se reinserta tal cual estaba).
            tasksAdapter.upsertOne(state, task);
            // RELATIVO, no absoluto: el optimistic update solo restó 1 a
            // `count` cuando esta tarea puntual salió de la vista, así que
            // el rollback solo debe sumar ese mismo 1 de vuelta — nunca
            // reasignar `count` a un valor guardado de antes. Un valor
            // absoluto pisaría el decremento de cualquier OTRO toggle que
            // haya quedado en vuelo al mismo tiempo (p.ej. count=10, dos
            // tareas salen de la vista en paralelo -> 9 -> 8; si la primera
            // falla, el rollback debe dejar 9, no volver a 10).
            if (removedFromView) {
                state.count += 1;
            }
        },

        taskRemovedFromTrash(state, action) {
            state.trashTasks = state.trashTasks.filter((task) => task.id !== action.payload);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(loadTasks.pending, (state, action) => {
                const { silent } = action.meta.arg ?? {};
                if (!silent) state.loading = true;
                // Igual que en Zustand: `error` se limpia al arrancar la
                // carga sin importar si es silenciosa o no.
                state.error = null;
            })
            .addCase(loadTasks.fulfilled, (state, action) => {
                const { data, silent } = action.payload;
                tasksAdapter.setAll(state, data.results);
                state.count = data.count;
                state.next = data.next;
                state.previous = data.previous;
                if (!silent) state.loading = false;
            })
            .addCase(loadTasks.rejected, (state, action) => {
                const { silent } = action.meta.arg ?? {};
                const payload = action.payload;
                if (!payload?.handled) {
                    state.error = payload?.message ?? "No se pudieron cargar las tareas.";
                }
                if (!silent) state.loading = false;
            })

            .addCase(loadTrash.pending, (state) => {
                state.trashLoading = true;
                state.trashError = null;
            })
            .addCase(loadTrash.fulfilled, (state, action) => {
                state.trashTasks = action.payload;
                state.trashLoading = false;
            })
            .addCase(loadTrash.rejected, (state, action) => {
                state.trashError = action.payload;
                state.trashLoading = false;
            })

            .addCase(addTask.rejected, (state, action) => {
                state.error = action.payload;
            })
            .addCase(updateTask.rejected, (state, action) => {
                state.error = action.payload;
            })
            .addCase(deleteTask.rejected, (state, action) => {
                state.error = action.payload;
            })

            .addCase(toggleStatus.fulfilled, (state) => {
                state.error = null;
            })
            .addCase(toggleStatus.rejected, (state, action) => {
                state.error = action.payload?.message ?? "No se pudo actualizar el estado de la tarea.";
            })

            .addCase(restoreTask.fulfilled, (state) => {
                state.trashError = null;
            })
            .addCase(restoreTask.rejected, (state, action) => {
                state.trashError = action.payload;
            })

            .addCase(reorderTo.fulfilled, (state, action) => {
                const orderedIds = action.payload;
                const reordered = orderedIds.map((id) => state.entities[id]).filter(Boolean);
                tasksAdapter.setAll(state, reordered);
                state.error = null;
            })
            .addCase(reorderTo.rejected, (state, action) => {
                state.error = action.payload;
            });
    },
});

export const {
    reset,
    pageChanged,
    completedFilterChanged,
    orderingChanged,
    searchChanged,
    taskToggledOptimistic,
    taskToggleRolledBack,
    taskRemovedFromTrash,
} = tasksSlice.actions;

export const tasksSelectors = tasksAdapter.getSelectors((state) => state.tasks);

export default tasksSlice.reducer;