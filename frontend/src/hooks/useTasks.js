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

export const useTasks = () => {
    // --- Tareas activas ---
    const [tasks, setTasks] = useState(() => []);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Papelera (tareas con is_deleted=true) ---
    const [trashTasks, setTrashTasks] = useState(() => []);
    const [trashLoading, setTrashLoading] = useState(false);
    const [trashError, setTrashError] = useState(null);

    const loadTasks = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getTasks();
            setTasks(data);
        } catch (err) {
            setError(extractErrorMessage(err, "No se pudieron cargar las tareas."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
    }, []);

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
            const newTask = await createTask(data);
            setTasks(prev => [newTask, ...prev]);
            setError(null);
        } catch (err) {
            setError(extractErrorMessage(err, "No se pudo crear la tarea."));
            throw err;
        }
    };

    const updateTask = async (id, data) => {
        try {
            const updated = await updateTaskApi(id, data);
            setTasks(prev =>
                prev.map(task => (task.id === id ? updated : task))
            );
            setError(null);
        } catch (err) {
            setError(extractErrorMessage(err, "No se pudo actualizar la tarea."));
            throw err;
        }
    };

    const deleteTask = async (id) => {
        try {
            await deleteTaskApi(id);
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
            const updated = await updateTaskApi(task.id, {
                completed: !task.completed,
            });
            setTasks(prev =>
                prev.map(t => (t.id === task.id ? updated : t))
            );
            setError(null);
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
            // localmente, se refresca el listado activo para reflejar el
            // orden real que calcula el servidor.
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
            // exactamente el conjunto completo de tareas activas del usuario).
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
    // `tasks` (que contiene siempre el conjunto COMPLETO de tareas activas
    // del usuario, sin filtrar) y envía el nuevo orden completo al backend.
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
        retryLoadTasks: loadTasks,

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