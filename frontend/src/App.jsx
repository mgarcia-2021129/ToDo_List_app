import { useTasks } from "./hooks/useTasks";
import TaskItem from "./components/TaskItem";
import { useState } from "react";
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

  const { logout } = useAuth();

  const {
    tasks,
    addTask,
    deleteTask,
    toggleStatus,
    updateTask
  } = useTasks();

  const filteredTasks = tasks.filter(task => {
    if (filter === "COMPLETE") return task.completed;
    if (filter === "INCOMPLETE") return !task.completed;
    return true;
  });

  return (
    <>
      <div className="page">
        <h1 className="title">TODO LIST</h1>

        <div className="controls">
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

          <button className="secondary-btn" onClick={logout}>
            Cerrar sesión
          </button>
        </div>

        <div className="task-wrapper">
          <div className="task-list">
            {tasks.length === 0 ? (
              <div className="empty-state">
                <p>No Todo Found</p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onDelete={deleteTask}
                  onToggle={toggleStatus}
                  onEdit={(task) => {
                    setEditingTask(task);
                    setIsOpen(true);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {isOpen && (
        <TaskModal
          key={editingTask?.id || "new"}
          onClose={() => setIsOpen(false)}
          onSave={async (data) => {
              if (editingTask) {
                  await updateTask(editingTask.id, data);
              } else {
                  await addTask(data);
              }
              setIsOpen(false);
          }}
          editingTask={editingTask}
        />
      )}
    </>
  );
}

export default App;