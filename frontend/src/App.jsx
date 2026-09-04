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
  const [filter, setFilter] = useState("ALL");
  const [view, setView] = useState("ACTIVE"); // "ACTIVE" | "TRASH"

  const { logout } = useAuth();

  const {
    tasks,
    loading,
    error,
    retryLoadTasks,
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

  const filteredTasks = tasks.filter(task => {
    if (filter === "COMPLETE") return task.completed;
    if (filter === "INCOMPLETE") return !task.completed;
    return true;
  });

  // El backend exige que /tasks/reorder/ reciba el conjunto COMPLETO de
  // tareas activas del usuario (apps/tasks/services.py). Si hay un filtro
  // aplicado, la lista visible es un subconjunto, así que reordenar dejaría
  // de tener sentido (o de ser válido) hasta volver a "ALL".
  const canReorder = filter === "ALL";

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

              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="ALL">ALL</option>
                <option value="COMPLETE">Complete</option>
                <option value="INCOMPLETE">Incomplete</option>
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
                    <p>No Todo Found</p>
                  </div>
                )
              ) : filteredTasks.length === 0 ? (
                <div className="empty-state">
                  <p>No hay tareas que coincidan con el filtro.</p>
                </div>
              ) : (
                filteredTasks.map((task, index) => (
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
                    canMoveDown={index < filteredTasks.length - 1}
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