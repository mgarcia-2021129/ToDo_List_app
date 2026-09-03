// Almacenamiento simple de los tokens JWT (access/refresh) en localStorage.
//
// Se centraliza aquí para que tanto el interceptor de Axios
// (src/api/axiosConfig.js) como la capa de autenticación
// (src/services/authService.js) y el contexto de React
// (src/context/AuthContext.jsx) lean/escriban siempre las mismas claves,
// sin duplicar strings ni lógica de acceso a localStorage.

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);

export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setTokens = ({ access, refresh } = {}) => {
  if (access) localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
};

export const setAccessToken = (access) => {
  if (access) localStorage.setItem(ACCESS_TOKEN_KEY, access);
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const hasSession = () => Boolean(getRefreshToken());