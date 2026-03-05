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
            task._id === id ? updated : task
        )
        );
    };

    const deleteTask = async (id) => {
        await deleteTaskApi(id);
        setTasks(prev =>
        prev.filter(task => task._id !== id)
        );
    };

    const toggleStatus = async (task) => {
        const updated = await updateTaskApi(task._id, {
        ...task,
        completed: !task.completed
        });

        setTasks(prev =>
        prev.map(t =>
            t._id === task._id ? updated : t
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