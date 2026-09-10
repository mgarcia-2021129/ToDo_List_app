import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
// el backend. Ver el mismo comentario en la versión pre-TanStack: no es un
// sistema de cancelación/carrera de peticiones, solo evita una petición por
// carácter tipeado. Se mantiene como estado local + efecto (no como parte de
// la capa de query) porque `searchInput` en sí es UI pura; lo único que
// entra a la query key es `debouncedSearch`.
const SEARCH_DEBOUNCE_MS = 400;

export const useTasks = () => {
    const queryClient = useQueryClient();

    // --- Parámetros de consulta: siguen siendo estado local de React, NO
    // server state. TanStack Query solo entra a partir de acá: cualquier
    // cambio en estos valores cambia la query key de abajo, y eso es lo que
    // dispara el refetch — reemplaza al useEffect con deps manuales que
    // existía en la versión useState/useEffect. ---
    const [completedFilter, setCompletedFilterState] = useState(undefined);
    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [ordering, setOrderingState] = useState("");
    const [page, setPage] = useState(1);

    const setCompletedFilter = (value) => {
        setCompletedFilterState(value);
        setPage(1);
    };

    const setOrdering = (value) => {
        setOrderingState(value);
        setPage(1);
    };

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(searchInput);
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(handle);
    }, [searchInput]);

    // Query key de la lista activa: incluye los cuatro parámetros que
    // determinan el resultado (igual que `currentParams` en la versión
    // anterior). Dos combinaciones distintas de filtro/búsqueda/orden/página
    // son, a propósito, dos entradas de caché distintas.
    const tasksListKey = [
        "tasks",
        "list",
        { completed: completedFilter, search: debouncedSearch, ordering, page },
    ];

    const tasksQuery = useQuery({
        queryKey: tasksListKey,
        queryFn: async () => {
            try {
                return await getTasks({ completed: completedFilter, search: debouncedSearch, ordering, page });
            } catch (err) {
                // DRF (PageNumberPagination) responde 404 con {"detail":
                // "Invalid page."} cuando se pide una página que ya no
                // existe (p.ej. se borró la última tarea visible en la
                // página 2). En vez de quedarse en un estado de error, si
                // todavía queda una página anterior se retrocede: cambiar
                // `page` cambia la query key y TanStack dispara el refetch
                // correcto solo, sin necesitar un efecto separado.
                //
                // No puede volverse un loop infinito: cada vez que entra acá
                // la página baja en 1, así que en el peor caso llega a
                // page=1; y page=1 nunca devuelve 404 (sin resultados, DRF
                // responde 200 con results: [] en vez de fallar).
                const requestedPage = page;
                if (err?.response?.status === 404 && requestedPage > 1) {
                    setPage((p) => Math.max(1, p - 1));
                    // Esta query (para la página inválida que ya no se va a
                    // volver a observar) SÍ queda en isError=true dentro de
                    // TanStack — eso no se puede evitar sin dejar de
                    // rechazar la promesa. Lo que se evita es que ese error
                    // llegue al banner: se marca para que el `error`
                    // consolidado de más abajo lo excluya explícitamente.
                    // Cualquier OTRO 404 (page=1, o sin `requestedPage>1`) o
                    // cualquier otro código de error sigue sin esta marca y
                    // se muestra normalmente.
                    err.isHandledPageCorrection = true;
                }
                throw err;
            }
        },
    });

    const tasks = tasksQuery.data?.results ?? [];
    const count = tasksQuery.data?.count ?? 0;
    const next = tasksQuery.data?.next ?? null;
    const previous = tasksQuery.data?.previous ?? null;

    // --- Papelera: también server state, pero cargada bajo demanda. No se
    // habilita automáticamente al montar el hook (equivalente a que
    // `trashTasks`/`trashLoading` arrancaran en [] / false antes): solo se
    // activa la primera vez que `loadTrash()` es invocado, igual que antes
    // (App.jsx sigue siendo quien decide CUÁNDO llamarlo, vía su efecto
    // sobre `view`, sin cambios). ---
    const [trashEnabled, setTrashEnabled] = useState(false);
    const trashQuery = useQuery({
        queryKey: ["tasks", "trash"],
        queryFn: getDeletedTasks,
        enabled: trashEnabled,
    });

    const loadTrash = () => {
        if (!trashEnabled) {
            setTrashEnabled(true);
        } else {
            // App.jsx llama loadTrash() cada vez que se entra a la vista
            // TRASH, no solo la primera vez (ver su efecto sobre `view`).
            // refetch() fuerza la petición aunque el caché todavía esté
            // "fresh", igual que la versión anterior siempre repetía el GET.
            trashQuery.refetch();
        }
    };

    // --- Mutaciones ---
    // Cada una usa taskService.js tal cual (ninguna llamada Axios nueva) y
    // define su propia estrategia de invalidación/actualización de caché.

    const addTaskMutation = useMutation({
        mutationFn: (data) => createTask(data),
        onSuccess: () => {
            // La tarea nueva puede no pertenecer a la vista actual (filtro,
            // búsqueda). Se invalida TODO "tasks","list" (prefijo, no query
            // exacta) para que cualquier combinación de filtros vigente en
            // caché quede marcada como stale, igual que antes se recargaba
            // "la consulta actual" sin asumir dónde cae la tarea nueva.
            queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
        },
    });

    const updateTaskMutation = useMutation({
        mutationFn: ({ id, data }) => updateTaskApi(id, data),
        onSuccess: () => {
            // Editar título/estado puede sacar la tarea de la vista actual
            // (deja de matchear `search` o `completed`); misma razón que en
            // addTask.
            queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
        },
    });

    const deleteTaskMutation = useMutation({
        mutationFn: (id) => deleteTaskApi(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
            // Soft delete: la tarea pasa a ser visible en la papelera. Se
            // invalida también esa query para que la próxima vez que se
            // entre a esa vista no dependa únicamente del refetch-on-enter.
            queryClient.invalidateQueries({ queryKey: ["tasks", "trash"] });
        },
    });

    const restoreTaskMutation = useMutation({
        mutationFn: (id) => restoreTaskApi(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks", "trash"] });
            queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
        },
    });

    const reorderMutation = useMutation({
        mutationFn: ({ orderedIds }) => reorderTasksApi(orderedIds),
        onSuccess: (_data, { orderedIds, listKey }) => {
            // El endpoint responde 200 sin cuerpo: igual que antes, el nuevo
            // orden se reconstruye localmente a partir del propio
            // `orderedIds` que el backend acaba de aceptar, sin round-trip
            // adicional (setQueryData, no invalidateQueries).
            queryClient.setQueryData(listKey, (old) => {
                if (!old) return old;
                const byId = new Map(old.results.map((t) => [t.id, t]));
                return { ...old, results: orderedIds.map((id) => byId.get(id)).filter(Boolean) };
            });
        },
    });

    // 6.9 / optimistic update obligatorio: cancelar la query relevante,
    // guardar snapshot, aplicar el cambio en caché, PATCH, rollback si
    // falla, revalidar en silencio si la tarea salió de la vista actual.
    //
    // El rollback es específico de ESTA tarea/mutación, no un snapshot
    // absoluto de toda la lista: si dos toggles concurrentes (tarea A y
    // tarea B) están en vuelo y resuelven en cualquier orden, el rollback
    // de uno no debe pisar el cambio optimista (ya aplicado o ya exitoso)
    // del otro. Por eso:
    // - onMutate solo guarda la tarea puntual como estaba antes (no toda la
    //   lista/count).
    // - onError reconstruye sobre el estado ACTUAL de la caché (updater
    //   funcional, no un valor guardado de antes) y solo toca esa tarea y,
    //   si corresponde, suma/resta 1 al count de forma relativa.
    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, completed }) => updateTaskApi(id, { completed }),
        onMutate: async ({ id, completed, removedFromView, listKey }) => {
            await queryClient.cancelQueries({ queryKey: listKey });
            const previousTask = queryClient
                .getQueryData(listKey)
                ?.results?.find((t) => t.id === id);

            queryClient.setQueryData(listKey, (old) => {
                if (!old) return old;
                if (removedFromView) {
                    return {
                        ...old,
                        count: Math.max(0, old.count - 1),
                        results: old.results.filter((t) => t.id !== id),
                    };
                }
                return {
                    ...old,
                    results: old.results.map((t) => (t.id === id ? { ...t, completed } : t)),
                };
            });

            return { previousTask, removedFromView, listKey };
        },
        onError: (_err, _variables, context) => {
            if (!context?.previousTask) return;
            const { previousTask, removedFromView, listKey } = context;
            queryClient.setQueryData(listKey, (old) => {
                if (!old) return old;
                const alreadyPresent = old.results.some((t) => t.id === previousTask.id);
                return {
                    ...old,
                    // Relativo, no absoluto (mismo criterio que el fix de
                    // `count` en RTK): solo se suma 1 de vuelta si ESTA
                    // mutación fue la que restó 1 al sacar la tarea de la
                    // vista, y solo si todavía no está presente (si otro
                    // toggle concurrente ya la reinsertó por su cuenta, no
                    // se vuelve a sumar).
                    count: removedFromView && !alreadyPresent ? old.count + 1 : old.count,
                    results: alreadyPresent
                        ? old.results.map((t) => (t.id === previousTask.id ? previousTask : t))
                        : [...old.results, previousTask],
                };
            });
        },
        onSuccess: (_data, { id, completed, removedFromView, listKey }) => {
            if (removedFromView) {
                // Igual que la revalidación "silenciosa" original: si la
                // tarea salió de la vista, count/next/previous reales solo
                // los sabe el backend, así que se revalida esa query
                // puntual. Como ya hay datos en caché, esto solo activa
                // `isFetching`, NO `isLoading` (no se pisa la lista
                // optimista con "Cargando tareas...").
                queryClient.invalidateQueries({ queryKey: listKey, exact: true });
                return;
            }
            // Reafirma el valor ya confirmado por el backend sobre el
            // estado ACTUAL de la caché (no sobre el snapshot de onMutate).
            // Necesario para el caso "un toggle concurrente mientras OTRA
            // mutación modifica la lista": mientras este PATCH estaba en
            // vuelo, un create/update/delete/restore puede haber invalidado
            // y refetcheado esta misma query key con datos del servidor
            // tomados antes de que este PATCH terminara, pisando el
            // optimistic update sin que nada lo hubiera confirmado después.
            // Sin este `setQueryData`, el toggle podía "revertirse"
            // visualmente aunque el backend ya lo hubiera aplicado. Si la
            // tarea ya no está en la vista actual (por ese mismo refetch
            // intermedio), el `.map` no encuentra el id y no hace nada.
            queryClient.setQueryData(listKey, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    results: old.results.map((t) => (t.id === id ? { ...t, completed } : t)),
                };
            });
        },
    });

    // --- Wrappers públicos: mismo nombre/firma que la versión anterior, así
    // App.jsx no necesita cambios. ---

    const addTask = (data) => addTaskMutation.mutateAsync(data);
    // mutateAsync re-lanza en error (igual que el `throw err` de antes):
    // App.jsx (handleSave) sigue pudiendo hacer try/await/catch tal cual.

    const updateTask = (id, data) => updateTaskMutation.mutateAsync({ id, data });

    const deleteTask = (id) => deleteTaskMutation.mutate(id);
    // .mutate (no .mutateAsync, sin await): TaskItem llama onDelete(id)
    // fire-and-forget, igual que antes. El error queda expuesto vía
    // deleteTaskMutation.isError más abajo, sin unhandled rejection.

    const restoreTask = (id) => restoreTaskMutation.mutate(id);

    const reorderTo = (orderedIds) => {
        reorderMutation.mutate({ orderedIds, listKey: tasksListKey });
    };

    // Mueve una tarea activa una posición hacia arriba/abajo dentro de
    // `tasks` y envía el nuevo orden completo al backend. Solo tiene sentido
    // cuando `tasks` es el conjunto completo de tareas activas (ver
    // `canReorder` en App.jsx, sin cambios).
    const moveTask = (taskId, direction) => {
        const index = tasks.findIndex((task) => task.id === taskId);
        if (index === -1) return;

        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= tasks.length) return;

        const reordered = [...tasks];
        [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

        reorderTo(reordered.map((task) => task.id));
    };

    const toggleStatus = (task) => {
        const newCompleted = !task.completed;
        const staysInCurrentView =
            completedFilter === undefined || completedFilter === newCompleted;

        toggleStatusMutation.mutate({
            id: task.id,
            completed: newCompleted,
            removedFromView: !staysInCurrentView,
            listKey: tasksListKey,
        });
    };

    const goToNextPage = () => {
        if (next) setPage((p) => p + 1);
    };

    const goToPreviousPage = () => {
        if (previous) setPage((p) => Math.max(1, p - 1));
    };

    // --- Error consolidado ---
    // La UI original (App.jsx) usa UN solo campo `error` para el banner de
    // tareas activas Y (en el mismo render, mismo valor) para decidir si
    // oculta la lista entera (`error ? null : tasks.length === 0 ? ... :
    // tasks.map(...)`). Eso es correcto cuando el error es de LA LISTA
    // (no hay datos válidos que mostrar). Pero un fallo de `toggleStatus`
    // es un error de UNA mutación puntual: `tasksQuery.data` sigue teniendo
    // la lista completa y correcta (el rollback de arriba ya la dejó bien),
    // así que no hay ninguna razón para esconderla. Por eso el error de
    // `toggleStatusMutation` NO entra a este campo (ver investigación
    // completa en la respuesta de este cambio). Las demás mutaciones
    // (create/update/delete/reorder) no se tocaron: no era el problema
    // reportado y cambiar su alcance no fue pedido en esta corrección.
    const error =
        (tasksQuery.isError &&
            !tasksQuery.error?.isHandledPageCorrection &&
            extractErrorMessage(tasksQuery.error, "No se pudieron cargar las tareas.")) ||
        (addTaskMutation.isError && extractErrorMessage(addTaskMutation.error, "No se pudo crear la tarea.")) ||
        (updateTaskMutation.isError && extractErrorMessage(updateTaskMutation.error, "No se pudo actualizar la tarea.")) ||
        (deleteTaskMutation.isError && extractErrorMessage(deleteTaskMutation.error, "No se pudo eliminar la tarea.")) ||
        (reorderMutation.isError && extractErrorMessage(reorderMutation.error, "No se pudo reordenar las tareas.")) ||
        null;

    const trashError =
        (trashQuery.isError && extractErrorMessage(trashQuery.error, "No se pudo cargar la papelera.")) ||
        (restoreTaskMutation.isError && extractErrorMessage(restoreTaskMutation.error, "No se pudo restaurar la tarea.")) ||
        null;

    // Error de `toggleStatus`, deliberadamente SEPARADO de `error`: no debe
    // participar en el `error ? null : tasks...` de App.jsx (eso ocultaría
    // toda la lista por el fallo de una sola tarea). `retryToggleStatus`
    // usa `toggleStatusMutation.variables` — las variables con las que se
    // llamó `.mutate()` la última vez, una primitiva propia de
    // `useMutation`, no una estructura global nueva — para reintentar
    // exactamente la misma mutación que falló.
    const toggleError =
        (toggleStatusMutation.isError &&
            extractErrorMessage(toggleStatusMutation.error, "No se pudo actualizar el estado de la tarea.")) ||
        null;

    const retryToggleStatus = () => {
        if (toggleStatusMutation.variables) {
            toggleStatusMutation.mutate(toggleStatusMutation.variables);
        }
    };

    return {
        tasks,
        // `isLoading` = sin datos en caché todavía para esta query key
        // (primera carga real de esta combinación de filtros/página). Una
        // combinación ya vista antes (caché fresh/stale) no vuelve a mostrar
        // "Cargando tareas...", solo refetch de fondo — comportamiento nuevo
        // que da TanStack Query "gratis" y que la versión anterior (sin
        // caché) no tenía.
        loading: tasksQuery.isLoading,
        error,
        retryLoadTasks: () => tasksQuery.refetch(),

        completedFilter,
        setCompletedFilter,
        searchInput,
        setSearch: setSearchInput,
        ordering,
        setOrdering,

        page,
        count,
        next,
        previous,
        goToNextPage,
        goToPreviousPage,

        trashTasks: trashQuery.data ?? [],
        trashLoading: trashQuery.isLoading,
        trashError,
        loadTrash,
        restoreTask,

        addTask,
        updateTask,
        deleteTask,
        toggleStatus,
        moveTask,
        toggleError,
        retryToggleStatus,
    };
};