const Todo = require("../models/todo.model");

// Crear todo
exports.createTodo = async (req, res) => {
  try {
    const { title } = req.body;

    const newTodo = await Todo.create({ title });

    res.status(201).json(newTodo);
  } catch (error) {
    res.status(500).json({ message: "Error creating todo" });
  }
};

// Obtener todos
exports.getTodos = async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });

    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: "Error fetching todos" });
  }
};

// Actualizar estado
exports.updateTodo = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedTodo = await Todo.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    res.json(updatedTodo);
  } catch (error) {
    res.status(500).json({ message: "Error updating todo" });
  }
};

// Eliminar
exports.deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;

    await Todo.findByIdAndDelete(id);

    res.json({ message: "Todo deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting todo" });
  }
};