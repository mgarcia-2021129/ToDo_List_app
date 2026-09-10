import { useEffect, useRef, useState } from "react";

// Debounce puro de UI para el input de búsqueda.
const SEARCH_DEBOUNCE_MS = 400;

export const useDebouncedSearch = (onDebouncedChange) => {
    const [searchInput, setSearchInput] = useState("");
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const handle = setTimeout(() => {
            onDebouncedChange(searchInput);
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    return [searchInput, setSearchInput];
};