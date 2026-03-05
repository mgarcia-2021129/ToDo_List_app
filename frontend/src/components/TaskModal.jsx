import { useState} from "react";

function TaskModal({ onClose, onSave, editingTask = null }) {
    const [title, setTitle] = useState(editingTask?.title || "");
    const [completed, setCompleted] = useState(editingTask?.completed ?? false);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ title, completed });
    };
    
    return (
            <div className="modal-overlay">
                <div className="modal-container">
                    <button className="floating-close" onClick={onClose}>✕</button>
                    <div className="modal">
                        <h2>{editingTask ? "Update Task" : "Add Task"}</h2>

                    <form onSubmit={handleSubmit}>
                        <label>Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />

                        <label>Status</label>
                        <select
                            value={completed ? "true" : "false"}
                            onChange={(e) =>
                                setCompleted(e.target.value === "true")
                            }
                        >
                            <option value="false">Incomplete</option>
                            <option value="true">Complete</option>
                        </select>

                        <div className="modal-buttons">
                            <button type="submit" className="primary-btn">
                                {editingTask ? "Update Task" : "Add Task"}
                            </button>

                            <button type="button" className="secondary-btn" onClick={onClose}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default TaskModal;