import { useEffect } from "react";
import { useTaskStore } from "../store/useTaskStore";

// Wrapper delgado sobre useTaskStore: conserva exactamente el mismo
// contrato (mismos nombres de estado y acciones) que antes exponía este
// hook con useState/useEffect propios, para que App.jsx no necesite
// ningún cambio. Toda la lógica de negocio vive ahora en el store
// (src/store/useTaskStore.js); este archivo solo se suscribe a él y
// dispara la carga inicial al montar.
export const useTasks = () => {
    const state = useTaskStore();

    // Antes, la carga inicial ocurría vía el useEffect reactivo que
    // escuchaba [completedFilter, debouncedSearch, ordering, page] con sus
    // valores iniciales. Zustand no tiene ese efecto propio (el store no
    // es un componente), así que el wrapper la dispara explícitamente al
    // montar. Como el store es un singleton que puede sobrevivir entre
    // desmontajes/montajes de TodoApp (logout + login, por ejemplo), se
    // hace reset() primero para que este montaje no herede estado
    // (tareas, filtros, búsqueda, página) de una sesión anterior.
    useEffect(() => {
        state.reset();
        state.loadTasks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        tasks: state.tasks,
        loading: state.loading,
        error: state.error,
        retryLoadTasks: state.retryLoadTasks,

        // Query server-side (6.5)
        completedFilter: state.completedFilter,
        setCompletedFilter: state.setCompletedFilter,
        searchInput: state.searchInput,
        setSearch: state.setSearch,
        ordering: state.ordering,
        setOrdering: state.setOrdering,

        // Paginación (6.6)
        page: state.page,
        count: state.count,
        next: state.next,
        previous: state.previous,
        goToNextPage: state.goToNextPage,
        goToPreviousPage: state.goToPreviousPage,

        trashTasks: state.trashTasks,
        trashLoading: state.trashLoading,
        trashError: state.trashError,
        loadTrash: state.loadTrash,
        restoreTask: state.restoreTask,

        addTask: state.addTask,
        updateTask: state.updateTask,
        deleteTask: state.deleteTask,
        toggleStatus: state.toggleStatus,
        moveTask: state.moveTask,
    };
};