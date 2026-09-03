// Capa de acceso a datos de autenticación, adaptada al backend Django REST
// (/api/v1/auth/). Igual que taskService.js, es un adaptador delgado sobre
// el cliente generado por Orval (src/api/generated/endpoints.ts): no se
// reimplementan llamadas HTTP a mano.
import {
  v1AuthLoginCreate,
  v1AuthRegisterCreate,
  v1AuthRefreshCreate,
} from "../api/generated/endpoints";
import { setTokens, clearTokens, getRefreshToken } from "../utils/tokenStorage";

export const register = async (username, password) => {
  // El serializer de registro solo acepta/devuelve username y password
  // (password nunca se serializa de vuelta). No inicia sesión por sí solo:
  // el backend no devuelve tokens en el registro.
  const response = await v1AuthRegisterCreate({ username, password });
  return response.data;
};

export const login = async (username, password) => {
  const response = await v1AuthLoginCreate({ username, password });
  const { access, refresh } = response.data;
  setTokens({ access, refresh });
  return response.data;
};

export const refresh = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No hay refresh token disponible.");
  }
  const response = await v1AuthRefreshCreate({ refresh: refreshToken });
  setTokens({ access: response.data.access });
  return response.data;
};

export const logout = () => {
  // El backend no expone un endpoint de logout/blacklist en esta fase;
  // cerrar sesión es un concepto puramente local: se eliminan los tokens
  // guardados en el frontend.
  clearTokens();
};