const express = require("express");
const router = express.Router();
const todoController = require("../controllers/todo.controller");

const validate = require("../middlewares/validate.middleware");
const {
    createTodoValidator,
    updateTodoValidator,
    idParamValidator,
} = require("../validators/todo.validator");

router.post(
    "/",
    createTodoValidator,
    validate,
    todoController.createTodo
);

router.get("/", todoController.getTodos);

router.put(
    "/:id",
    updateTodoValidator,
    validate,
    todoController.updateTodo
);

router.delete(
    "/:id",
    idParamValidator,
    validate,
    todoController.deleteTodo
);

module.exports = router;