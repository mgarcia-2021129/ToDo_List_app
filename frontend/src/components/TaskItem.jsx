import { Pencil, Trash } from "lucide-react";

const TaskItem = ({ task, onDelete, onToggle, onEdit }) => {
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
                {new Date(task.createdAt).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true
                })},{" "}
                {new Date(task.createdAt).toLocaleDateString("en-US", {
                    month: "2-digit",
                    day: "2-digit",
                    year: "numeric"
                })}
            </p>
            </div>
        </div>
        
        <div className="task-actions">
            <div className="square-box" onClick={() => onEdit(task)}>
            <Pencil size={16} color="#555" />
            </div>

            <div
            className="square-box"
            onClick={() => onDelete(task._id)}
            >
            <Trash size={16} color="#555" />
            </div>
        </div>
        </div>
    );
};

export default TaskItem;