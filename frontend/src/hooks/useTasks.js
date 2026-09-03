import { useEffect, useState } from "react";
import {
    getTasks,
    createTask,
    deleteTask as deleteTaskApi,
    updateTask as updateTaskApi
} from "../services/taskService";

export const useTasks = () => {
    const [tasks, setTasks] = useState(() => []);

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const data = await getTasks();
                setTasks(data);
            } catch (error) {
                console.error(error);
            }
        };

        fetchTasks();
    }, []);

    const addTask = async (data) => {
        const newTask = await createTask(data);
        setTasks(prev => [newTask, ...prev]);
    };

    const updateTask = async (id, data) => {
        const updated = await updateTaskApi(id, data);

        setTasks(prev =>
        prev.map(task =>
            task.id === id ? updated : task
        )
        );
    };

    const deleteTask = async (id) => {
        await deleteTaskApi(id);
        setTasks(prev =>
        prev.filter(task => task.id !== id)
        );
    };

    const toggleStatus = async (task) => {
        // El backend solo acepta PATCH parcial (title?, completed?), no el
        // objeto completo. Enviar campos de solo-lectura como `id`,
        // `position`, `is_deleted`, etc. no rompe la petición (el serializer
        // de update los ignora), pero no corresponde al contrato: se envía
        // únicamente el campo que realmente cambia.
        const updated = await updateTaskApi(task.id, {
        completed: !task.completed
        });

        setTasks(prev =>
        prev.map(t =>
            t.id === task.id ? updated : t
        )
        );
    };

    return {
        tasks,
        addTask,
        updateTask,
        deleteTask,
        toggleStatus
    };
};