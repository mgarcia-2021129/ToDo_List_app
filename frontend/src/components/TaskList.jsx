import TaskItem from "./TaskItem";

function TaskList({ tasks, onDelete, onToggle, onEdit }) {
    return (
        <div>
            {tasks.map((task) => (
                <TaskItem
                    key={task._id}
                    task={task}
                    onDelete={onDelete}
                    onToggle={onToggle}
                    onEdit={onEdit}
                />
            ))}
        </div>
    );
}

export default TaskList;