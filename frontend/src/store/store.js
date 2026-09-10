import { configureStore } from "@reduxjs/toolkit";
import tasksReducer from "./tasksSlice";

// Un solo slice: el estado de auth se queda en Context (AuthContext), fuera
// de Redux, igual que en la versión Zustand.
export const store = configureStore({
    reducer: {
        tasks: tasksReducer,
    },
});
