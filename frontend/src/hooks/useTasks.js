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
    // `completedFilter`: undefined (ALL) | true (COMPLETE) | false (INCOMPLETE)
    const [completedFilter, setCompletedFilter] = useState(undefined);
    // Valor tal cual lo tipea el usuario (input controlado, sin debounce).
    const [searchInput, setSearchInput] = useState("");
    // Valor que realmente se envía al backend, con debounce aplicado.
    const [debouncedSearch, setDebouncedSearch] = useState("");
    // "" (default del backend: position, created_at) | "-created_at" | "created_at" | "position"
    const [ordering, setOrdering] = useState("");

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(searchInput);
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

    // Los tres parámetros de consulta soportados por 6.5, combinables entre
    // sí (completar uno no borra los demás porque viven en estados
    // independientes, no en un único objeto que se sobreescribe entero).
    const currentParams = {
        completed: completedFilter,
        search: debouncedSearch,
        ordering,
    };

    const loadTasks = async (params = currentParams) => {
        setLoading(true);
        setError(null);
        try {
            const data = await getTasks(params);
            setTasks(data);
        } catch (err) {
            setError(extractErrorMessage(err, "No se pudieron cargar las tareas."));
        } finally {
            setLoading(false);
        }
    };

    // Vuelve a pedir el listado cada vez que cambia cualquiera de los tres
    // parámetros de consulta (filtro de estado, búsqueda debounced u
    // ordering). Reemplaza el filtrado local (`tasks.filter(...)`) que
    // existía antes de 6.5: ahora Django ya devuelve solo lo que
    // corresponde a la combinación actual de parámetros.
    useEffect(() => {
        loadTasks({ completed: completedFilter, search: debouncedSearch, ordering });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [completedFilter, debouncedSearch, ordering]);

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
            // El soft delete saca a la tarea de cualquier consulta de
            // activas sin excepción, así que quitarla localmente del
            // array es siempre correcto (no hace falta refetch).
            setTasks(prev => prev.filter(task => task.id !== id));
            setError(null);
        } catch (err) {
            setError(extractErrorMessage(err, "No se pudo eliminar la tarea."));
            throw err;
        }
    };

    const toggleStatus = async (task) => {
        try {
            // El backend solo acepta PATCH parcial (title?, completed?): se
            // envía únicamente el campo que realmente cambia.
            await updateTaskApi(task.id, {
                completed: !task.completed,
            });
            setError(null);
            // Igual que en updateTask: si hay un filtro `completed` activo,
            // completar/descompletar puede hacer que la tarea deba
            // desaparecer de la vista actual. Se refresca la consulta.
            await loadTasks();
        } catch (err) {
            setError(extractErrorMessage(err, "No se pudo actualizar el estado de la tarea."));
            throw err;
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
            setTrashError(extractErrorMessage(err, "No se pudo restaurar la tarea."));
            throw err;
        }
    };

    const reorderTo = async (orderedIds) => {
        try {
            await reorderTasksApi(orderedIds);
            // El endpoint de reorder responde 200 sin cuerpo: el nuevo orden
            // se reconstruye localmente a partir del propio `orderedIds` que
            // el backend acaba de aceptar (services.py ya validó que es
            // exactamente el conjunto completo de tareas activas del
            // usuario). Esto solo se invoca cuando la vista actual ES ese
            // conjunto completo sin filtrar (ver `canReorder` en App.jsx).
            setTasks(prev => {
                const byId = new Map(prev.map(task => [task.id, task]));
                return orderedIds.map(id => byId.get(id)).filter(Boolean);
            });
            setError(null);
        } catch (err) {
            setError(extractErrorMessage(err, "No se pudo reordenar las tareas."));
            throw err;
        }
    };

    // Mueve una tarea activa una posición hacia arriba o abajo dentro de
    // `tasks` (que en este momento contiene el conjunto COMPLETO de tareas
    // activas del usuario, sin filtrar/buscar/reordenar por otro criterio;
    // ver `canReorder` en App.jsx) y envía el nuevo orden completo al backend.
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