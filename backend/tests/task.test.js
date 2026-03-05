const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");

beforeAll(async () => {
    await mongoose.connect("mongodb://127.0.0.1:27017/test_tasks");
});

afterAll(async () => {
    await mongoose.connection.close();
});

describe("Task API", () => {

    test("GET /api/tasks - obtener todas las tareas", async () => {
        const res = await request(app).get("/api/tasks");

        expect(res.statusCode).toBe(200);
    });

    test("POST /api/tasks - crear una tarea", async () => {
        const res = await request(app)
        .post("/api/tasks")
        .send({
            title: "Test task",
            description: "Testing jest"
        });

        expect(res.statusCode).toBe(201);
    });

    test("POST /api/tasks - error si no hay titulo", async () => {
        const res = await request(app)
        .post("/api/tasks")
        .send({
            description: "sin titulo"
        });

        expect(res.statusCode).toBe(400);
    });

});