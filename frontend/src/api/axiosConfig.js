// Configuración global de axios para el cliente generado por Orval.
//
// El cliente generado (src/api/generated/endpoints.ts) hace `import axios from "axios"`
// y llama a axios.get/post/patch/delete con rutas RELATIVAS (ej: `/api/v1/tasks/`).
// Como todos los módulos comparten la misma instancia singleton de axios,
// basta con configurar aquí axios.defaults.baseURL UNA sola vez, antes de que
// se dispare cualquier llamada, para que el cliente generado apunte al backend
// correcto sin tener que tocar el código generado (que no debe editarse a mano).
//
// Este archivo se importa una única vez desde main.jsx, antes de renderizar <App />.
import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  clearTokens,
} from "../utils/tokenStorage";

axios.defaults.baseURL = import.meta.env.VITE_API_URL;

// Rutas de autenticación: nunca deben llevar el Authorization header de un
// access token viejo, ni disparar el flujo de refresh si responden 401/403
// (un login o registro con credenciales inválidas no es una sesión expirada).
const AUTH_PATHS = [
  "/api/v1/auth/login/",
  "/api/v1/auth/register/",
  "/api/v1/auth/refresh/",
];
const isAuthRequest = (url = "") => AUTH_PATHS.some((path) => url.includes(path));

// --- Request interceptor: adjunta Authorization: Bearer <access> ---
axios.interceptors.request.use((config) => {
  if (!isAuthRequest(config.url)) {
    const access = getAccessToken();
    if (access) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${access}`;
    }
  }
  return config;
});

// --- Response interceptor: intenta refrescar el access token una vez ante
// un 401, y reintenta la petición original. Si el refresh falla (o no hay
// refresh token), limpia la sesión y avisa a la app vía evento global para
// que vuelva a mostrar login/registro. ---
let refreshPromise = null;

const notifySessionExpired = () => {
  clearTokens();
  window.dispatchEvent(new Event("auth:logout"));
};

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (!response || response.status !== 401 || !config || isAuthRequest(config.url)) {
      return Promise.reject(error);
    }

    if (config._retry) {
      // Ya se intentó refrescar para esta petición y volvió a fallar.
      notifySessionExpired();
      return Promise.reject(error);
    }

    const refresh = getRefreshToken();
    if (!refresh) {
      notifySessionExpired();
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      // Varias peticiones pueden llegar en paralelo con un 401 al mismo
      // tiempo; se comparte una única promesa de refresh para no disparar
      // múltiples llamadas a /auth/refresh/ simultáneas.
      if (!refreshPromise) {
        refreshPromise = axios
          .post("/api/v1/auth/refresh/", { refresh })
          .then((res) => {
            const newAccess = res.data.access;
            setAccessToken(newAccess);
            return newAccess;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newAccess = await refreshPromise;
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${newAccess}`;
      return axios(config);
    } catch (refreshError) {
      notifySessionExpired();
      return Promise.reject(refreshError);
    }
  }
);

export default axios;