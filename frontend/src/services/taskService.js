const API_URL = "http://localhost:5000/api/tasks";

export const getTasks = async () => {
    const response = await fetch(API_URL);
    const result = await response.json();

    if (!response.ok) throw new Error(result.message);

    return result.data;
};

export const createTask = async (data) => {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.message);

    return result.data;
};

export const updateTask = async (id, data) => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.message);

    return result.data;
};

export const deleteTask = async (id) => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.message);
};