import { useEffect, useState } from "react";

// Debounce puro de UI para el input de búsqueda: mantiene el valor tal
// cual lo tipea el usuario (sin debounce, para que el <input> no "salte")
// y notifica el valor debounced a quien lo necesite (el store de tareas)
// tras SEARCH_DEBOUNCE_MS sin cambios. No conoce nada de tareas ni del
// store: solo produce un valor debounced a partir de un valor de UI. Por
// eso es el mismo hook, sin cambios, en la versión Zustand y en la de RTK.
const SEARCH_DEBOUNCE_MS = 400;

export const useDebouncedSearch = (onDebouncedChange) => {
    const [searchInput, setSearchInput] = useState("");

    useEffect(() => {
        const handle = setTimeout(() => {
            onDebouncedChange(searchInput);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    return [searchInput, setSearchInput];
};