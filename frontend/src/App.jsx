import { useTasks } from "./hooks/useTasks";
import TaskItem from "./components/TaskItem";
import TrashItem from "./components/TrashItem";
import { useEffect, useState } from "react";
import TaskModal from "./components/TaskModal";
import { useAuth } from "./hooks/useAuth";
import AuthPage from "./components/AuthPage";

function App() {
  const { isAuthenticated } = useAuth();

  // Se monta TodoApp solo cuando hay sesión: así useTasks() (y su fetch
  // inicial) no se ejecuta mientras el usuario no está autenticado.
  return isAuthenticated ? <TodoApp /> : <AuthPage />;
}

function TodoApp() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [view, setView] = useState("ACTIVE"); // "ACTIVE" | "TRASH"

  const { logout } = useAuth();

  const {
    tasks,
    loading,
    error,
    retryLoadTasks,
    completedFilter,
    setCompletedFilter,
    searchInput,
    setSearch,
    ordering,
    setOrdering,
    trashTasks,
    trashLoading,
    trashError,
    loadTrash,
    addTask,
    deleteTask,
    toggleStatus,
    updateTask,
    restoreTask,
    moveTask,
  } = useTasks();

  // La papelera se carga bajo demanda (no en cada render ni junto con las
  // tareas activas), la primera vez que el usuario entra a esa vista.
  useEffect(() => {
    if (view === "TRASH") {
      loadTrash();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Valor mostrado en el <select> de estado, derivado de completedFilter
  // (undefined | true | false) tal como lo maneja el hook.
  const statusFilterValue =
    completedFilter === undefined ? "ALL" : completedFilter ? "COMPLETE" : "INCOMPLETE";

  const handleStatusFilterChange = (value) => {
    if (value === "ALL") setCompletedFilter(undefined);
    else setCompletedFilter(value === "COMPLETE");
  };

  // `tasks` ya viene filtrada/buscada/ordenada por el backend (6.5): no se
  // vuelve a filtrar en el cliente.
  const hasActiveQuery = completedFilter !== undefined || searchInput.trim() !== "";

  // El backend exige que /tasks/reorder/ reciba el conjunto COMPLETO de
  // tareas activas del usuario, en el orden natural (posición), ya que
  // services.py valida que sea exactamente ese conjunto. Si hay un filtro
  // de estado, una búsqueda, o un ordering distinto al de posición
  // aplicados, `tasks` es un subconjunto o un orden distinto del real, así
  // que reordenar dejaría de ser válido hasta volver a la vista sin filtros.
  const canReorder =
    completedFilter === undefined &&
    searchInput.trim() === "" &&
    (ordering === "" || ordering === "position");

  const handleSave = async (data) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, data);
      } else {
        await addTask(data);
      }
      setIsOpen(false);
    } catch {
      // El error ya queda expuesto vía el banner de `error` del hook;
      // el modal se deja abierto para que el usuario pueda corregir y
      // reintentar en vez de perder lo que había escrito.
    }
  };

  return (
    <>
      <div className="page">
        <h1 className="title">TODO LIST</h1>

        <div className="controls">
          {view === "ACTIVE" ? (
            <>
              <button
                className="primary-btn"
                onClick={() => {
                  setEditingTask(null);
                  setIsOpen(true);
                }}
              >
                Add Task
              </button>

              <input
                type="text"
                className="search-input"
                placeholder="Buscar por título..."
                value={searchInput}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                value={statusFilterValue}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
              >
                <option value="ALL">ALL</option>
                <option value="COMPLETE">Complete</option>
                <option value="INCOMPLETE">Incomplete</option>
              </select>

              <select value={ordering} onChange={(e) => setOrdering(e.target.value)}>
                <option value="">Orden manual (posición)</option>
                <option value="-created_at">Más recientes primero</option>
                <option value="created_at">Más antiguas primero</option>
              </select>

              <button className="secondary-btn" onClick={() => setView("TRASH")}>
                Papelera
              </button>
            </>
          ) : (
            <button className="secondary-btn" onClick={() => setView("ACTIVE")}>
              ← Volver a tareas
            </button>
          )}

          <button className="secondary-btn" onClick={logout}>
            Cerrar sesión
          </button>
        </div>

        {view === "ACTIVE" ? (
          <div className="task-wrapper">
            {error && (
              <div className="error-banner">
                <p>{error}</p>
                <button className="secondary-btn" onClick={retryLoadTasks}>
                  Reintentar
                </button>
              </div>
            )}

            <div className="task-list">
              {loading ? (
                <div className="empty-state">
                  <p>Cargando tareas...</p>
                </div>
              ) : tasks.length === 0 ? (
                !error && (
                  <div className="empty-state">
                    <p>{hasActiveQuery ? "No hay tareas que coincidan con el filtro." : "No Todo Found"}</p>
                  </div>
                )
              ) : (
                tasks.map((task, index) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onDelete={deleteTask}
                    onToggle={toggleStatus}
                    onEdit={(task) => {
                      setEditingTask(task);
                      setIsOpen(true);
                    }}
                    canReorder={canReorder}
                    canMoveUp={index > 0}
                    canMoveDown={index < tasks.length - 1}
                    onMoveUp={(id) => moveTask(id, "up")}
                    onMoveDown={(id) => moveTask(id, "down")}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="task-wrapper">
            {trashError && (
              <div className="error-banner">
                <p>{trashError}</p>
                <button className="secondary-btn" onClick={loadTrash}>
                  Reintentar
                </button>
              </div>
            )}

            <div className="task-list">
              {trashLoading ? (
                <div className="empty-state">
                  <p>Cargando papelera...</p>
                </div>
              ) : trashTasks.length === 0 ? (
                !trashError && (
                  <div className="empty-state">
                    <p>La papelera está vacía.</p>
                  </div>
                )
              ) : (
                trashTasks.map((task) => (
                  <TrashItem key={task.id} task={task} onRestore={restoreTask} />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {isOpen && (
        <TaskModal
          key={editingTask?.id || "new"}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
          editingTask={editingTask}
        />
      )}
    </>
  );
}

export default App;