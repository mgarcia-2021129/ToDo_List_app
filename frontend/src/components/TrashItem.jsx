import { RotateCcw } from "lucide-react";

// Representa una tarea eliminada (is_deleted=true) dentro de la papelera.
// A diferencia de TaskItem, no permite completar/editar/eliminar ni
// reordenar: el backend solo acepta `restore` sobre tareas ya eliminadas
// (ver get_queryset() en apps/tasks/views.py).
const TrashItem = ({ task, onRestore }) => {
    return (
        <div className="task-item trash-item">
            <div className="task-left">
                <div>
                    <p className="task-title completed">{task.title}</p>
                    <p className="task-date">
                        Eliminada el{" "}
                        {new Date(task.deleted_at).toLocaleDateString("en-US", {
                            month: "2-digit",
                            day: "2-digit",
                            year: "numeric",
                        })}
                        ,{" "}
                        {new Date(task.deleted_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                        })}
                    </p>
                </div>
            </div>

            <div className="task-actions">
                <button
                    type="button"
                    className="square-box"
                    onClick={() => onRestore(task.id)}
                    title="Restaurar tarea"
                >
                    <RotateCcw size={16} color="#555" />
                </button>
            </div>
        </div>
    );
};

export default TrashItem;