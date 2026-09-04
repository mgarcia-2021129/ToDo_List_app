import { Pencil, Trash, ChevronUp, ChevronDown } from "lucide-react";

const TaskItem = ({
    task,
    onDelete,
    onToggle,
    onEdit,
    canReorder = false,
    canMoveUp = false,
    canMoveDown = false,
    onMoveUp,
    onMoveDown,
}) => {
    return (
        <div className="task-item">
        <div className="task-left">
            <div
            className={`square-box ${task.completed ? "checked" : ""}`}
            onClick={() => onToggle(task)}
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