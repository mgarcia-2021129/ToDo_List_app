import { create } from "zustand";
import {
    getTasks,
    getDeletedTasks,
    createTask,
    deleteTask as deleteTaskApi,
    updateTask as updateTaskApi,
    restoreTask as restoreTaskApi,
    reorderTasks as reorderTasksApi,
} from "../services/taskService";

// Extrae un mensaje de error legible de una respuesta de DRF.
// DRF suele responder {"detail": "..."} (errores de permisos/autenticación,
// 409 de restore) o {"campo": ["mensaje"]} (errores de validación de
// serializer). Si no hay respuesta del servidor (error de red, CORS, etc.)
// se usa el mensaje por defecto.
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

// Cuánto esperar tras la última tecla antes de disparar la búsqueda contra
// el backend. Sin este pequeño debounce, cada carácter tipeado dispararía
// una petición GET /api/v1/tasks/?search=... independiente (y, por las
// respuestas asíncronas, podrían llegar desordenadas y pisarse entre sí).
// 400ms es un valor conservador solo para evitar ese ruido; no es un
// sistema de cancelación/carrera de peticiones.
const SEARCH_DEBOUNCE_MS = 400;

// Timer de debounce a nivel de módulo (no de store): Zustand no tiene
// useEffect/cleanup propio, así que el timer vive fuera del store y se
// cancela explícitamente tanto al llegar una nueva tecla como en reset().
let searchDebounceTimer = null;

// Secuenciación de peticiones de loadTasks() a nivel de módulo (no de
// store, por la misma razón que el timer de arriba): sin esto, dos
// llamadas a loadTasks() en vuelo al mismo tiempo (p.ej. por el doble
// efecto de montaje de React.StrictMode en desarrollo, o por cambios
// rápidos de filtro/búsqueda/página) pueden resolver en cualquier orden,
// y la que responde más tarde pisa el estado de la que responde después
// de ella pero fue disparada antes — dejando `tasks`/`error` inconsistentes
// entre sí aunque cada llamada individualmente sea correcta. Cada
// invocación de loadTasks() toma un id nuevo; solo la invocación cuyo id
// sigue siendo el más reciente en el momento en que su respuesta llega
// puede aplicar su resultado (éxito o error) al store.
let loadTasksRequestId = 0;

const initialState = {
    // --- Query server-side: completed / search / ordering ---
    // `completedFilter`: undefined (ALL) | true (COMPLETE) | false (INCOMPLETE)
    completedFilter: undefined,
    // Valor tal cual lo tipea el usuario (input controlado, sin debounce).
    searchInput: "",
    // Valor que realmente se envía al backend, con debounce aplicado.
    debouncedSearch: "",
    // "" (default del backend: position, created_at) | "-created_at" | "created_at" | "position"
    ordering: "",

    // --- Paginación (6.6) ---
    page: 1,
    count: 0,
    next: null,
    previous: null,

    // --- Tareas activas ---
    tasks: [],
    loading: true,
    error: null,

    // --- Papelera (tareas con is_deleted=true) ---
    trashTasks: [],
    trashLoading: false,
    trashError: null,
};

export const useTaskStore = create((set, get) => ({
    ...initialState,

    // `silent`: usado por toggleStatus (6.9) para revalidar tras un PATCH ya
    // exitoso cuando la tarea sale de la vista actual. En ese caso no debe
    // pisarse la lista optimista con "Cargando tareas..." (no toca
    // `loading`), y un fallo de esta revalidación no debe mostrarse como
    // error ni provocar rollback: la mutación principal ya tuvo éxito, así
    // que este GET es best-effort (ver excepción de la página inválida más
    // abajo, que sí debe seguir aplicando igual en modo silencioso).
    loadTasks: async (params, { silent = false } = {}) => {
        const {
            completedFilter, debouncedSearch, ordering, page,
        } = get();
        const currentParams = params ?? {
            completed: completedFilter, search: debouncedSearch, ordering, page,
        };

        // Esta invocación reclama el id más reciente en el momento en que
        // arranca (sincrónico, antes del primer `await`, así que en ese
        // instante siempre es la más nueva). Si para cuando su respuesta
        // llegue alguna otra invocación posterior ya avanzó el contador,
        // `isStale()` lo detecta y esta respuesta se descarta sin tocar el
        // store.
        const requestId = ++loadTasksRequestId;
        const isStale = () => requestId !== loadTasksRequestId;

        if (!silent) set({ loading: true });
        set({ error: null });
        try {
            const data = await getTasks(currentParams);
            if (isStale()) return;
            set({
                tasks: data.results,
                count: data.count,
                next: data.next,
                previous: data.previous,
            });
        } catch (err) {
            if (isStale()) return;
            const requestedPage = currentParams.page ?? 1;
            // DRF (PageNumberPagination) responde 404 con {"detail": "Invalid
            // page."} cuando se pide una página que ya no existe. Esto puede
            // pasar legítimamente aunque el usuario no haya tocado la
            // paginación: p.ej. está en la página 2 y borra la última tarea
            // visible ahí, con lo cual la página 2 deja de existir en el
            // momento en que se vuelve a pedir tras el delete.
            //
            // En vez de mostrar ese error, si todavía queda una página
            // anterior (requestedPage > 1) se retrocede una y se dispara el
            // refetch explícitamente con esa página nueva, conservando el
            // resto de los parámetros vigentes (no se tocan
            // completed/search/ordering). Esto aplica igual en modo
            // silencioso: la página inválida debe corregirse sí o sí para
            // que la lista vuelva a sincronizarse, sin importar si el
            // llamador pidió una revalidación silenciosa.
            //
            // Esto no puede volverse un loop infinito: cada vez que entra a
            // esta rama la página baja en 1, así que en el peor caso llega a
            // page=1; y page=1 nunca devuelve 404 (si no hay resultados,
            // DRF responde 200 con results: [] en vez de fallar), por lo que
            // la cadena de reintentos siempre termina en, como mucho,
            // `requestedPage - 1` pasos.
            if (err?.response?.status === 404 && requestedPage > 1) {
                const newPage = requestedPage - 1;
                set({ page: newPage });
                await get().loadTasks({ ...currentParams, page: newPage }, { silent });
                return;
            }
            // En modo silencioso, cualquier otro fallo de esta revalidación
            // (red, 5xx, etc.) se ignora a propósito: no hay setError ni
            // rollback, porque el PATCH que la disparó ya tuvo éxito. La UI
            // optimista se mantiene tal cual quedó; en el peor caso
            // count/next/previous quedan desactualizados hasta la próxima
            // carga real.
            if (!silent) {
                set({ error: extractErrorMessage(err, "No se pudieron cargar las tareas.") });
            }
        } finally {
            // Si esta invocación quedó obsoleta (una más reciente ya
            // avanzó `loadTasksRequestId`), no se toca `loading`: esa
            // invocación más nueva ya está gestionando su propio
            // loading/error/tasks, y este `finally` tardío no debe
            // apagarlo por ella.
            if (!isStale() && !silent) set({ loading: false });
        }
    },

    loadTrash: async () => {
        set({ trashLoading: true, trashError: null });
        try {
            const data = await getDeletedTasks();
            set({ trashTasks: data });
        } catch (err) {
            set({ trashError: extractErrorMessage(err, "No se pudo cargar la papelera.") });
        } finally {
            set({ trashLoading: false });
        }
    },

    addTask: async (data) => {
        try {
            await createTask(data);
            set({ error: null });
            // La tarea nueva puede no pertenecer a la vista actual (p.ej. si
            // hay un filtro `completed=true` activo y se crea una tarea
            // incompleta, o si no coincide con la búsqueda). En vez de
            // asumir que siempre va al principio de `tasks`, se vuelve a
            // pedir la consulta actual para que la lista visible sea
            // exactamente la que el backend considera válida.
            await get().loadTasks();
        } catch (err) {
            set({ error: extractErrorMessage(err, "No se pudo crear la tarea.") });
            throw err;
        }
    },

    updateTask: async (id, data) => {
        try {
            await updateTaskApi(id, data);
            set({ error: null });
            // Editar el título o el estado puede sacar a la tarea de la
            // vista actual (deja de matchear `search`, o de cumplir el
            // filtro `completed`). Se refresca la consulta activa por la
            // misma razón que en addTask.
            await get().loadTasks();
        } catch (err) {
            set({ error: extractErrorMessage(err, "No se pudo actualizar la tarea.") });
            throw err;
        }
    },

    deleteTask: async (id) => {
        try {
            await deleteTaskApi(id);
            set({ error: null });
            // Antes de 6.6 alcanzaba con sacar la tarea del array local
            // (el soft delete la excluye de cualquier consulta de activas
            // sin excepción). Pero ahora `count`/`next`/`previous` también
            // dependen de cuántas tareas activas quedan, y una remoción
            // puramente local los dejaría desactualizados (p.ej. "next"
            // seguiría habilitado con una página que ya no existe). Se
            // refresca la consulta actual para mantener esa información
            // correcta, igual que ya se hace en addTask/updateTask/toggleStatus.
            await get().loadTasks();
        } catch (err) {
            // No se relanza: nada consume la excepción (TaskItem llama
            // onDelete(task.id) directamente, sin await/catch), así que un
            // throw aquí solo generaría un "unhandled promise rejection" en
            // consola sin aportar nada — el error ya queda visible vía
            // setError + el banner existente (igual que toggleStatus, 6.7).
            set({ error: extractErrorMessage(err, "No se pudo eliminar la tarea.") });
        }
    },

    toggleStatus: async (task) => {
        const originalCompleted = task.completed;
        const newCompleted = !originalCompleted;

        const { completedFilter } = get();

        const staysInCurrentView =
            completedFilter === undefined ||
            completedFilter === newCompleted;

        // Aplicación optimista: modifica únicamente esta tarea
        // usando siempre el estado más reciente del store.
        set((state) => ({
            tasks: staysInCurrentView
                ? state.tasks.map((t) =>
                    t.id === task.id
                        ? { ...t, completed: newCompleted }
                        : t
                )
                : state.tasks.filter((t) => t.id !== task.id),

            count: staysInCurrentView
                ? state.count
                : Math.max(0, state.count - 1),
        }));

        try {
            await updateTaskApi(task.id, {
                completed: newCompleted,
            });

            // El PATCH fue exitoso.
            set({ error: null });

            // Si la tarea salió de la vista actual, revalidamos
            // silenciosamente para actualizar paginación/count.
            if (!staysInCurrentView) {
                await get().loadTasks(undefined, { silent: true });
            }
        } catch (err) {
            set((state) => {
                const stillPresent = state.tasks.some(
                    (t) => t.id === task.id
                );

                if (staysInCurrentView || stillPresent) {
                    return {
                        tasks: state.tasks.map((t) =>
                            t.id === task.id
                                ? { ...t, completed: originalCompleted }
                                : t
                        ),
                    };
                }

                return {
                    tasks: [
                        ...state.tasks,
                        {
                            ...task,
                            completed: originalCompleted,
                        },
                    ],
                    count: state.count + 1,
                };
            });

            set({
                error: extractErrorMessage(
                    err,
                    "No se pudo actualizar el estado de la tarea."
                ),
            });
        }
    },

    restoreTask: async (id) => {
        try {
            await restoreTaskApi(id);
            set(state => ({ trashTasks: state.trashTasks.filter(task => task.id !== id) }));
            // El backend conserva la posición original de la tarea restaurada
            // (restore() no la modifica). En vez de adivinar dónde insertarla
            // localmente, se refresca el listado activo (respetando el
            // filtro/búsqueda/ordering vigentes) para reflejar el resultado
            // real que calcula el servidor.
            await get().loadTasks();
            set({ trashError: null });
        } catch (err) {
            // No se relanza: TrashItem llama onRestore(task.id) directamente
            // sin await/catch. El error queda visible vía trashError + el
            // banner propio de la papelera (independiente del de tareas
            // activas, ver `error`).
            set({ trashError: extractErrorMessage(err, "No se pudo restaurar la tarea.") });
        }
    },

    reorderTo: async (orderedIds) => {
        try {
            await reorderTasksApi(orderedIds);
            // El endpoint de reorder responde 200 sin cuerpo: el nuevo orden
            // se reconstruye localmente a partir del propio `orderedIds` que
            // el backend acaba de aceptar (services.py ya validó que es
            // exactamente el conjunto completo de tareas activas del
            // usuario). Esto solo se invoca cuando `tasks` ES ese conjunto
            // completo: sin filtro de estado, sin búsqueda, con ordering de
            // posición, y con una sola página de resultados (ver
            // `canReorder` en App.jsx, que ahora también exige
            // `!next && !previous`; con paginación, `tasks` deja de ser el
            // total de tareas activas en cuanto hay más de una página).
            set(state => {
                const byId = new Map(state.tasks.map(task => [task.id, task]));
                return { tasks: orderedIds.map(id => byId.get(id)).filter(Boolean) };
            });
            set({ error: null });
        } catch (err) {
            // No se relanza: moveTask() no tiene su propio try/catch (solo
            // hace `await reorderTo(...)`), y quien la invoca (TaskItem, vía
            // onMoveUp/onMoveDown) tampoco captura la promesa. El error ya
            // queda visible vía setError + el banner existente.
            set({ error: extractErrorMessage(err, "No se pudo reordenar las tareas.") });
        }
    },

    // Mueve una tarea activa una posición hacia arriba o abajo dentro de
    // `tasks` y envía el nuevo orden completo al backend. Solo tiene
    // sentido llamarla cuando `tasks` es efectivamente el conjunto
    // completo de tareas activas del usuario (ver `canReorder` en
    // App.jsx); con un filtro, búsqueda, ordering distinto de posición, o
    // más de una página, `tasks` es un subconjunto o un orden parcial.
    moveTask: async (taskId, direction) => {
        const { tasks } = get();
        const index = tasks.findIndex(task => task.id === taskId);
        if (index === -1) return;

        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= tasks.length) return;

        const reordered = [...tasks];
        [reordered[index], reordered[targetIndex]] = [
            reordered[targetIndex],
            reordered[index],
        ];

        await get().reorderTo(reordered.map(task => task.id));
    },

    // Solo avanzan si el backend efectivamente indicó que hay una página
    // siguiente/anterior (`next`/`previous`); si no, no hacen nada (el
    // botón correspondiente además queda deshabilitado en la UI).
    goToNextPage: () => {
        const { next, page, completedFilter, debouncedSearch, ordering } = get();
        if (!next) return;
        const newPage = page + 1;
        set({ page: newPage });
        get().loadTasks({ completed: completedFilter, search: debouncedSearch, ordering, page: newPage });
    },

    goToPreviousPage: () => {
        const { previous, page, completedFilter, debouncedSearch, ordering } = get();
        if (!previous) return;
        const newPage = Math.max(1, page - 1);
        set({ page: newPage });
        get().loadTasks({ completed: completedFilter, search: debouncedSearch, ordering, page: newPage });
    },

    // Cambiar de filtro/ordering es, en la versión con useEffect, un evento
    // síncrono que se agrupaba (batch) con el setPage(1) dentro del mismo
    // render, así el efecto de fetch veía ambos cambios juntos y disparaba
    // una sola petición con page=1. Sin ese efecto reactivo, cada setter
    // dispara `loadTasks` explícitamente ya con page=1 y el valor nuevo.
    setCompletedFilter: (value) => {
        set({ completedFilter: value, page: 1 });
        const { debouncedSearch, ordering } = get();
        get().loadTasks({ completed: value, search: debouncedSearch, ordering, page: 1 });
    },

    setOrdering: (value) => {
        set({ ordering: value, page: 1 });
        const { completedFilter, debouncedSearch } = get();
        get().loadTasks({ completed: completedFilter, search: debouncedSearch, ordering: value, page: 1 });
    },

    // Input controlado: se actualiza de inmediato (sin debounce) para que
    // el usuario vea lo que tipea. El valor que efectivamente se envía al
    // backend (`debouncedSearch`) se actualiza 400ms después de la última
    // tecla, cancelando cualquier timer pendiente, igual que hacía el
    // useEffect original.
    setSearch: (value) => {
        set({ searchInput: value });

        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            set({ debouncedSearch: value, page: 1 });
            const { completedFilter, ordering } = get();
            get().loadTasks({ completed: completedFilter, search: value, ordering, page: 1 });
        }, SEARCH_DEBOUNCE_MS);
    },

    retryLoadTasks: () => get().loadTasks(),

    // Zustand es singleton: sin este reset, un usuario nuevo (tras
    // logout/login, o simplemente al volver a montar TodoApp) heredaría el
    // estado de tareas/filtros/búsqueda del usuario o sesión anterior. Se
    // restauran todos los valores iniciales y se cancela cualquier timer de
    // debounce pendiente de una sesión previa.
    reset: () => {
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = null;
        }
        set({ ...initialState });
    },
}));