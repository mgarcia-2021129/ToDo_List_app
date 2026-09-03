import { useContext } from "react";
import AuthContext from "../context/authContextBase";

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de un <AuthProvider>.");
  }
  return ctx;
};