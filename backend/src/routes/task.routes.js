const express = require("express");
const router = express.Router();
const taskController = require("../controllers/task.controller");

const validate = require("../middlewares/validate.middleware");
const {
    createTaskValidator,
    updateTaskValidator,
    idParamValidator,
} = require("../validators/task.validator");

router.post(
    "/",
    createTaskValidator,
    validate,
    taskController.createTask
);

router.get("/", taskController.getTasks);

router.put(
    "/:id",
    updateTaskValidator,
    validate,
    taskController.updateTask
);

router.delete(
    "/:id",
    idParamValidator,
    validate,
    taskController.deleteTask
);

module.exports = router;