import { useSelector } from "react-redux";
import { Pencil, Trash, ChevronUp, ChevronDown } from "lucide-react";
import { tasksSelectors } from "../store/tasksSlice";

// Único cambio estructural frente a la versión Zustand: en vez de recibir
// el objeto `task` completo como prop (y depender de que el padre
// re-renderice con la lista entera), este componente selecciona
// únicamente SU PROPIA entidad del store. Actualizar otra tarea no debería
// causar que este componente vuelva a renderizar — es justamente lo que el
// comparativo del proyecto necesita poder medir.
const TaskItem = ({
    taskId,
    onDelete,
    onToggle,
    onEdit,
    canReorder = false,
    canMoveUp = false,
    canMoveDown = false,
    onMoveUp,
    onMoveDown,
}) => {
    const task = useSelector((state) => tasksSelectors.selectById(state, taskId));

    // Guarda defensiva: si la tarea deja de existir en el store (p.ej. un
    // refetch la excluyó) en el breve instante antes de que el padre deje
    // de renderizar este item, se evita un crash por acceder a
    // propiedades de `undefined`.
    if (!task) return null;

    return (
        <div className="task-item">
        <div className="task-left">
            <div
            className={`square-box ${task.completed ? "checked" : ""}`}
            onClick={() => onToggle(task.id)}
            >
            ✓
            </div>

            <div>
            <p className={`task-title ${task.completed ? "completed" : ""}`}>
            {task.title}
            </p>
            <p className="task-date">
                {new Date(task.created_at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true
                })},{" "}
                {new Date(task.created_at).toLocaleDateString("en-US", {
                    month: "2-digit",
                    day: "2-digit",
                    year: "numeric"
                })}
            </p>
            </div>
        </div>
        
        <div className="task-actions">
            {canReorder && (
                <>
                    <button
                        type="button"
                        className="square-box move-btn"
                        onClick={() => onMoveUp(task.id)}
                        disabled={!canMoveUp}
                        title="Mover arriba"
                    >
                        <ChevronUp size={16} color="#555" />
                    </button>
                    <button
                        type="button"
                        className="square-box move-btn"
                        onClick={() => onMoveDown(task.id)}
                        disabled={!canMoveDown}
                        title="Mover abajo"
                    >
                        <ChevronDown size={16} color="#555" />
                    </button>
                </>
            )}

            <div className="square-box" onClick={() => onEdit(task)}>
            <Pencil size={16} color="#555" />
            </div>

            <div
            className="square-box"
            onClick={() => onDelete(task.id)}
            >
            <Trash size={16} color="#555" />
            </div>
        </div>
        </div>
    );
};

export default TaskItem;