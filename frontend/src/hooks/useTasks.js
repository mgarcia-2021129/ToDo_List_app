import { useEffect, useState } from "react";
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

export const useTasks = () => {
    // --- Query server-side: completed / search / ordering ---
    // `completedFilterState`: undefined (ALL) | true (COMPLETE) | false (INCOMPLETE)
    const [completedFilter, setCompletedFilterState] = useState(undefined);
    // Valor tal cual lo tipea el usuario (input controlado, sin debounce).
    const [searchInput, setSearchInput] = useState("");
    // Valor que realmente se envía al backend, con debounce aplicado.
    const [debouncedSearch, setDebouncedSearch] = useState("");
    // "" (default del backend: position, created_at) | "-created_at" | "created_at" | "position"
    const [ordering, setOrderingState] = useState("");

    // --- Paginación (6.6) ---
    const [page, setPage] = useState(1);
    const [count, setCount] = useState(0);
    const [next, setNext] = useState(null);
    const [previous, setPrevious] = useState(null);

    // Cambiar de filtro/ordering es un evento síncrono (onChange de un
    // <select>): React agrupa (batch) el setState del propio parámetro y el
    // setPage(1) dentro del mismo render, así el efecto de fetch de abajo
    // los ve ya actualizados juntos y dispara una sola petición con
    // page=1 en vez de una con la página vieja y otra inmediatamente
    // después con page=1.
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
            // El reset de página va adentro del propio timeout (junto con
            // setDebouncedSearch) por la misma razón que en setOrdering:
            // que ambos cambios de estado lleguen juntos al efecto de
            // fetch, no en dos renders separados.
            setDebouncedSearch(searchInput);
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(handle);
    }, [searchInput]);

    // --- Tareas activas ---
    const [tasks, setTasks] = useState(() => []);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Papelera (tareas con is_deleted=true) ---
    const [trashTasks, setTrashTasks] = useState(() => []);
    const [trashLoading, setTrashLoading] = useState(false);
    const [trashError, setTrashError] = useState(null);

    // Los cuatro parámetros de consulta soportados hasta 6.6, combinables
    // entre sí (cambiar uno no borra los demás porque viven en estados
    // independientes, no en un único objeto que se sobreescribe entero).
    const currentParams = {
        completed: completedFilter,
        search: debouncedSearch,
        ordering,
        page,
    };

    const loadTasks = async (params = currentParams) => {
        setLoading(true);
        setError(null);
        try {
            const data = await getTasks(params);
            setTasks(data.results);
            setCount(data.count);
            setNext(data.next);
            setPrevious(data.previous);
        } catch (err) {
            const requestedPage = params.page ?? 1;
            // DRF (PageNumberPagination) responde 404 con {"detail": "Invalid
            // page."} cuando se pide una página que ya no existe. Esto puede
            // pasar legítimamente aunque el usuario no haya tocado la
            // paginación: p.ej. está en la página 2 y borra la última tarea
            // visible ahí, con lo cual la página 2 deja de existir en el
            // momento en que se vuelve a pedir tras el delete.
            //
            // En vez de mostrar ese error, si todavía queda una página
            // anterior (requestedPage > 1) se retrocede una y se deja que el
            // efecto de [completedFilter, debouncedSearch, ordering, page]
            // dispare el refetch normal ahí, conservando el resto de los
            // parámetros vigentes (no se tocan completed/search/ordering).
            //
            // Esto no puede volverse un loop infinito: cada vez que entra a
            // esta rama la página baja en 1, así que en el peor caso llega a
            // page=1; y page=1 nunca devuelve 404 (si no hay resultados,
            // DRF responde 200 con results: [] en vez de fallar), por lo que
            // la cadena de reintentos siempre termina en, como mucho,
            // `requestedPage - 1` pasos.
            if (err?.response?.status === 404 && requestedPage > 1) {
                setPage(requestedPage - 1);
                return;
            }
            setError(extractErrorMessage(err, "No se pudieron cargar las tareas."));
        } finally {
            setLoading(false);
        }
    };

    // Vuelve a pedir el listado cada vez que cambia cualquiera de los
    // cuatro parámetros de consulta (filtro de estado, búsqueda debounced,
    // ordering o página). Reemplaza el filtrado local (`tasks.filter(...)`)
    // que existía antes de 6.5: ahora Django ya devuelve solo lo que
    // corresponde a la combinación actual de parámetros.
    useEffect(() => {
        loadTasks({ completed: completedFilter, search: debouncedSearch, ordering, page });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [completedFilter, debouncedSearch, ordering, page]);

    const loadTrash = async () => {
        setTrashLoading(true);
        setTrashError(null);
        try {
            const data = await getDeletedTasks();
            setTrashTasks(data);
        } catch (err) {
            setTrashError(extractErrorMessage(err, "No se pudo cargar la papelera."));
        } finally {
            setTrashLoading(false);
        }
    };

    const addTask = async (data) => {
        try {
            await createTask(data);
            setError(null);
            // La tarea nueva puede no pertenecer a la vista actual (p.ej. si
            // hay un filtro `completed=true` activo y se crea una tarea
            // incompleta, o si no coincide con la búsqueda). En vez de
            // asumir que siempre va al principio de `tasks`, se vuelve a
            // pedir la consulta actual para que la lista visible sea
            // exactamente la que el backend considera válida.
            await loadTasks();
        } catch (err) {
            setError(extractErrorMessage(err, "No se pudo crear la tarea."));
            throw err;
        }
    };

    const updateTask = async (id, data) => {
        try {
            await updateTaskApi(id, data);
            setError(null);
            // Editar el título o el estado puede sacar a la tarea de la
            // vista actual (deja de matchear `search`, o de cumplir el
            // filtro `completed`). Se refresca la consulta activa por la
            // misma razón que en addTask.
            await loadTasks();
        } catch (err) {
            setError(extractErrorMessage(err, "No se pudo actualizar la tarea."));
            throw err;
        }
    };

    const deleteTask = async (id) => {
        try {
            await deleteTaskApi(id);
            setError(null);
            // Antes de 6.6 alcanzaba con sacar la tarea del array local
            // (el soft delete la excluye de cualquier consulta de activas
            // sin excepción). Pero ahora `count`/`next`/`previous` también
            // dependen de cuántas tareas activas quedan, y una remoción
            // puramente local los dejaría desactualizados (p.ej. "next"
            // seguiría habilitado con una página que ya no existe). Se
            // refresca la consulta actual para mantener esa información
            // correcta, igual que ya se hace en addTask/updateTask/toggleStatus.
            await loadTasks();
        } catch (err) {
            // No se relanza: nada consume la excepción (TaskItem llama
            // onDelete(task.id) directamente, sin await/catch), así que un
            // throw aquí solo generaría un "unhandled promise rejection" en
            // consola sin aportar nada — el error ya queda visible vía
            // setError + el banner existente (igual que toggleStatus, 6.7).
            setError(extractErrorMessage(err, "No se pudo eliminar la tarea."));
        }
    };

    const toggleStatus = async (task) => {
        const previousTasks = tasks;
        const previousCount = count;

        const newCompleted = !task.completed;
        const staysInCurrentView =
            completedFilter === undefined || completedFilter === newCompleted;

        setTasks(prev =>
            staysInCurrentView
                ? prev.map(t => (t.id === task.id ? { ...t, completed: newCompleted } : t))
                : prev.filter(t => t.id !== task.id)
        );

        if (!staysInCurrentView) {
            setCount(c => Math.max(0, c - 1));
        }
        
        try {
            await updateTaskApi(task.id, { completed: newCompleted });
            setError(null);
        } catch (err) {
            setTasks(previousTasks);
            setCount(previousCount);
            setError(extractErrorMessage(err, "No se pudo actualizar el estado de la tarea."));
        }
    };

    const restoreTask = async (id) => {
        try {
            await restoreTaskApi(id);
            setTrashTasks(prev => prev.filter(task => task.id !== id));
            // El backend conserva la posición original de la tarea restaurada
            // (restore() no la modifica). En vez de adivinar dónde insertarla
            // localmente, se refresca el listado activo (respetando el
            // filtro/búsqueda/ordering vigentes) para reflejar el resultado
            // real que calcula el servidor.
            await loadTasks();
            setTrashError(null);
        } catch (err) {
            // No se relanza: TrashItem llama onRestore(task.id) directamente
            // sin await/catch. El error queda visible vía trashError + el
            // banner propio de la papelera (independiente del de tareas
            // activas, ver `error`).
            setTrashError(extractErrorMessage(err, "No se pudo restaurar la tarea."));
        }
    };

    const reorderTo = async (orderedIds) => {
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
            setTasks(prev => {
                const byId = new Map(prev.map(task => [task.id, task]));
                return orderedIds.map(id => byId.get(id)).filter(Boolean);
            });
            setError(null);
        } catch (err) {
            // No se relanza: moveTask() no tiene su propio try/catch (solo
            // hace `await reorderTo(...)`), y quien la invoca (TaskItem, vía
            // onMoveUp/onMoveDown) tampoco captura la promesa. El error ya
            // queda visible vía setError + el banner existente.
            setError(extractErrorMessage(err, "No se pudo reordenar las tareas."));
        }
    };

    // Mueve una tarea activa una posición hacia arriba o abajo dentro de
    // `tasks` y envía el nuevo orden completo al backend. Solo tiene
    // sentido llamarla cuando `tasks` es efectivamente el conjunto
    // completo de tareas activas del usuario (ver `canReorder` en
    // App.jsx); con un filtro, búsqueda, ordering distinto de posición, o
    // más de una página, `tasks` es un subconjunto o un orden parcial.
    const moveTask = async (taskId, direction) => {
        const index = tasks.findIndex(task => task.id === taskId);
        if (index === -1) return;

        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= tasks.length) return;

        const reordered = [...tasks];
        [reordered[index], reordered[targetIndex]] = [
            reordered[targetIndex],
            reordered[index],
        ];

        await reorderTo(reordered.map(task => task.id));
    };

    // Solo avanzan si el backend efectivamente indicó que hay una página
    // siguiente/anterior (`next`/`previous`); si no, no hacen nada (el
    // botón correspondiente además queda deshabilitado en la UI).
    const goToNextPage = () => {
        if (next) setPage(p => p + 1);
    };

    const goToPreviousPage = () => {
        if (previous) setPage(p => Math.max(1, p - 1));
    };

    return {
        tasks,
        loading,
        error,
        retryLoadTasks: () => loadTasks(),

        // Query server-side (6.5)
        completedFilter,
        setCompletedFilter,
        searchInput,
        setSearch: setSearchInput,
        ordering,
        setOrdering,

        // Paginación (6.6)
        page,
        count,
        next,
        previous,
        goToNextPage,
        goToPreviousPage,

        trashTasks,
        trashLoading,
        trashError,
        loadTrash,
        restoreTask,

        addTask,
        updateTask,
        deleteTask,
        toggleStatus,
        moveTask,
    };
};