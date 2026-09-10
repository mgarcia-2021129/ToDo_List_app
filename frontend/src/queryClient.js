import { QueryClient } from "@tanstack/react-query";

// QueryClient único para toda la app (ver main.jsx: se instancia una sola
// vez a nivel de módulo, por eso NO se crea con `useState(() => new
// QueryClient())` dentro de un componente — no hay ningún componente por
// encima de <QueryClientProvider> que se vuelva a montar).
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Un 404 de paginación (`?page=N` fuera de rango, ver queryFn de
            // la lista de tareas en useTasks.js) es una señal semántica para
            // corregir `page`, no una falla transitoria: reintentar la misma
            // página solo repetiría el mismo 404. Para cualquier otro error
            // (red, 5xx) se permite un único reintento automático — ni 0
            // (menos resiliente que antes) ni el default de la librería (3,
            // "configuraciones exageradas" para este proyecto).
            retry: (failureCount, error) => {
                if (error?.response?.status === 404) return false;
                return failureCount < 1;
            },
            // 15s: evita refetch inmediato al volver a una combinación de
            // filtro/página ya vista hace instantes (p.ej. Anterior/Siguiente
            // rápido), sin llegar a un cacheo agresivo que oculte cambios
            // reales por mucho tiempo.
            staleTime: 15_000,
            // El hook original nunca revalidaba al recuperar el foco de la
            // ventana; se mantiene ese comportamiento para no introducir
            // refetches nuevos que antes no existían.
            refetchOnWindowFocus: false,
        },
        mutations: {
            // Las mutaciones (crear/editar/borrar/restaurar/reordenar/toggle)
            // no se reintentan automáticamente: un retry automático de un
            // POST/PATCH/DELETE podría duplicar el efecto en el backend.
            retry: 0,
        },
    },
});