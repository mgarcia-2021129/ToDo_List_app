import { useDispatch, useSelector } from "react-redux";
import TaskItem from "./components/TaskItem";
import TrashItem from "./components/TrashItem";
import { useEffect, useState } from "react";
import TaskModal from "./components/TaskModal";
import { useAuth } from "./hooks/useAuth";
import AuthPage from "./components/AuthPage";
import { useDebouncedSearch } from "./hooks/useDebouncedSearch";
import {
  tasksSelectors,
  loadTasks,
  loadTrash,
  reset,
  addTask,
  updateTask,
  deleteTask,
  toggleStatus,
  restoreTask,
  moveTask,
  goToNextPage,
  goToPreviousPage,
  setCompletedFilter,
  setOrdering,
  setSearch,
} from "./store/tasksSlice";

function App() {
  const { isAuthenticated } = useAuth();

  // Se monta TodoApp solo cuando hay sesión: así el fetch inicial de
  // tareas no se dispara mientras el usuario no está autenticado.
  return isAuthenticated ? <TodoApp /> : <AuthPage />;
}

function TodoApp() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [view, setView] = useState("ACTIVE"); // "ACTIVE" | "TRASH"

  const { logout } = useAuth();
  const dispatch = useDispatch();

  const taskIds = useSelector(tasksSelectors.selectIds);
  const loading = useSelector((state) => state.tasks.loading);
  const error = useSelector((state) => state.tasks.error);
  const completedFilter = useSelector((state) => state.tasks.completedFilter);
  const ordering = useSelector((state) => state.tasks.ordering);
  const page = useSelector((state) => state.tasks.page);
  const count = useSelector((state) => state.tasks.count);
  const next = useSelector((state) => state.tasks.next);
  const previous = useSelector((state) => state.tasks.previous);
  const trashTasks = useSelector((state) => state.tasks.trashTasks);
  const trashLoading = useSelector((state) => state.tasks.trashLoading);
  const trashError = useSelector((state) => state.tasks.trashError);

  // Valor tecleado por el usuario (sin debounce); `setSearch` es el
  // action creator que recibe el valor YA debounced y dispara el fetch,
  // igual que en la versión Zustand.
  const [searchInput, setSearchInput] = useDebouncedSearch((value) =>
    dispatch(setSearch(value))
  );

  // Carga inicial + reset de sesión: el store de Redux es un singleton de
  // módulo (igual que el de Zustand), así que se reinicia explícitamente
  // al montar <TodoApp> para no arrastrar filtros/página/papelera de una
  // sesión anterior (logout -> login).
  useEffect(() => {
    dispatch(reset());
    dispatch(loadTasks({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La papelera se carga bajo demanda, la primera vez que el usuario
  // entra a esa vista.
  useEffect(() => {
    if (view === "TRASH") {
      dispatch(loadTrash());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Valor mostrado en el <select> de estado, derivado de completedFilter
  // (undefined | true | false).
  const statusFilterValue =
    completedFilter === undefined ? "ALL" : completedFilter ? "COMPLETE" : "INCOMPLETE";

  const handleStatusFilterChange = (value) => {
    if (value === "ALL") dispatch(setCompletedFilter(undefined));
    else dispatch(setCompletedFilter(value === "COMPLETE"));
  };

  // `tasks` ya viene filtrada/buscada/ordenada por el backend: no se
  // vuelve a filtrar en el cliente.
  const hasActiveQuery = completedFilter !== undefined || searchInput.trim() !== "";

  // El backend exige que /tasks/reorder/ reciba el conjunto COMPLETO de
  // tareas activas del usuario, en el orden natural (posición). Si hay un
  // filtro de estado, una búsqueda, un ordering distinto al de posición, o
  // más de una página de resultados, `taskIds` es un subconjunto o un
  // orden distinto del real, así que reordenar dejaría de ser válido.
  const canReorder =
    completedFilter === undefined &&
    searchInput.trim() === "" &&
    (ordering === "" || ordering === "position") &&
    !next &&
    !previous;

  const handleSave = async (data) => {
    try {
      if (editingTask) {
        await dispatch(updateTask({ id: editingTask.id, data })).unwrap();
      } else {
        await dispatch(addTask(data)).unwrap();
      }
      setIsOpen(false);
    } catch {
      // El error ya queda expuesto vía el banner de `error` del slice;
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
                onChange={(e) => setSearchInput(e.target.value)}
              />

              <select
                value={statusFilterValue}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
              >
                <option value="ALL">ALL</option>
                <option value="COMPLETE">Complete</option>
                <option value="INCOMPLETE">Incomplete</option>
              </select>

              <select
                value={ordering}
                onChange={(e) => dispatch(setOrdering(e.target.value))}
              >
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
                <button className="secondary-btn" onClick={() => dispatch(loadTasks({}))}>
                  Reintentar
                </button>
              </div>
            )}

            <div className="task-list">
              {loading ? (
                <div className="empty-state">
                  <p>Cargando tareas...</p>
                </div>
              ) : taskIds.length === 0 ? (
                <div className="empty-state">
                  <p>{hasActiveQuery ? "No hay tareas que coincidan con el filtro." : "No Todo Found"}</p>
                </div>
              ) : (
                taskIds.map((id, index) => (
                  <TaskItem
                    key={id}
                    taskId={id}
                    onDelete={(taskId) => dispatch(deleteTask(taskId))}
                    onToggle={(taskId) => dispatch(toggleStatus(taskId))}
                    onEdit={(task) => {
                      setEditingTask(task);
                      setIsOpen(true);
                    }}
                    canReorder={canReorder}
                    canMoveUp={index > 0}
                    canMoveDown={index < taskIds.length - 1}
                    onMoveUp={(taskId) => dispatch(moveTask(taskId, "up"))}
                    onMoveDown={(taskId) => dispatch(moveTask(taskId, "down"))}
                  />
                ))
              )}
            </div>

            {!error && (
              <div className="pagination">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => dispatch(goToPreviousPage())}
                  disabled={loading || !previous}
                >
                  ← Anterior
                </button>

                <span className="pagination-info">
                  Página {page}{count > 0 ? ` · ${count} tarea${count === 1 ? "" : "s"}` : ""}
                </span>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => dispatch(goToNextPage())}
                  disabled={loading || !next}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="task-wrapper">
            {trashError && (
              <div className="error-banner">
                <p>{trashError}</p>
                <button className="secondary-btn" onClick={() => dispatch(loadTrash())}>
                  Reintentar
                </button>
              </div>
            )}

            <div className="task-list">
              {trashLoading ? (
                <div className="empty-state">
                  <p>Cargando papelera...</p>
                </div>
              ) : trashError ? null : trashTasks.length === 0 ? (
                <div className="empty-state">
                  <p>La papelera está vacía.</p>
                </div>
              ) : (
                trashTasks.map((task) => (
                  <TrashItem
                    key={task.id}
                    task={task}
                    onRestore={(id) => dispatch(restoreTask(id))}
                  />
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
