const express = require('express');
const cors = require("cors");
const taskRoutes = require("./routes/task.routes");
const errorHandler = require("./middlewares/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/tasks", taskRoutes);

app.get('/', (req, res) => {
    res.send('API running');
});

app.use(errorHandler);

module.exports = app;