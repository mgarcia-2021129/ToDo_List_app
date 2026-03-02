const express = require('express');
const todoRoutes = require("./routes/todo.routes");
const errorHandler = require("./middlewares/error.middleware");

const app = express();

app.use(express.json());

app.use("/api/todos", todoRoutes);

app.get('/', (req, res) => {
    res.send('API running');
});

app.use(errorHandler);

module.exports = app;