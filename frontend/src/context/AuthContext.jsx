import { useEffect, useState, useCallback } from "react";
import * as authService from "../services/authService";
import { hasSession } from "../utils/tokenStorage";
import AuthContext from "./authContextBase";

export function AuthProvider({ children }) {
  // No hay endpoint de "usuario actual", así que la sesión se deriva de la
  // presencia de un refresh token en localStorage. No es una verificación
  // de que el token siga siendo válido en el backend; si expiró, la
  // primera petición protegida lo detectará (401 -> intento de refresh ->
  // si falla, se dispara auth:logout, ver axiosConfig.js).
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasSession());
  const [authError, setAuthError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleForcedLogout = () => setIsAuthenticated(false);
    window.addEventListener("auth:logout", handleForcedLogout);
    return () => window.removeEventListener("auth:logout", handleForcedLogout);
  }, []);

  const login = useCallback(async (username, password) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await authService.login(username, password);
      setIsAuthenticated(true);
    } catch (error) {
      setAuthError(extractErrorMessage(error, "No se pudo iniciar sesión."));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const register = useCallback(async (username, password) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await authService.register(username, password);
      // El registro no devuelve tokens (ver authService.js), así que tras
      // registrarse se hace login inmediatamente para iniciar sesión.
      await authService.login(username, password);
      setIsAuthenticated(true);
    } catch (error) {
      setAuthError(extractErrorMessage(error, "No se pudo completar el registro."));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, login, register, logout, authError, isSubmitting }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// El backend (DRF) devuelve errores de validación como un objeto
// { campo: ["mensaje", ...] } o { detail: "mensaje" }. Se extrae el primer
// mensaje disponible para mostrarlo en el formulario.
function extractErrorMessage(error, fallback) {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data.detail === "string") return data.detail;
  const firstKey = Object.keys(data)[0];
  if (firstKey) {
    const value = data[firstKey];
    if (Array.isArray(value)) return value[0];
    if (typeof value === "string") return value;
  }
  return fallback;
}