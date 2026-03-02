const Todo = require("../models/todo.model");
const mongoose = require("mongoose");

// Crear todo
exports.createTodo = async (req, res, next) => {
  try {
    const { title } = req.body;

    if (!title || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Se requiere título",
      });
    }

    const newTodo = await Todo.create({ title });

    res.status(201).json({
      success: true,
      data: newTodo,
    });
  } catch (error) {
    next(error);
  }
};

// Obtener todos
exports.getTodos = async (req, res, next) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: todos,
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar todo
exports.updateTodo = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID no válido",
      });
    }

    const updatedTodo = await Todo.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!updatedTodo) {
      return res.status(404).json({
        success: false,
        message: "ToDo no encontrado",
      });
    }

    res.json({
      success: true,
      data: updatedTodo,
    });
  } catch (error) {
    next(error);
  }
};

// Eliminar todo
exports.deleteTodo = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID no válido",
      });
    }

    const deletedTodo = await Todo.findByIdAndDelete(id);

    if (!deletedTodo) {
      return res.status(404).json({
        success: false,
        message: "ToDo no encontrado",
      });
    }

    res.json({
      success: true,
      message: "ToDo eliminado",
    });
  } catch (error) {
    next(error);
  }
};