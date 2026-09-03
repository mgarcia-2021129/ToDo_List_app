import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

function AuthPage() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState(null);

  const { login, register, authError, isSubmitting } = useAuth();

  const isLogin = mode === "login";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim() || !password) {
      setLocalError("Usuario y contraseña son obligatorios.");
      return;
    }

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch {
      // El mensaje ya queda expuesto vía authError desde el contexto.
    }
  };

  const switchMode = () => {
    setMode(isLogin ? "register" : "login");
    setLocalError(null);
  };

  return (
    <div className="page">
      <h1 className="title">TODO LIST</h1>

      <div className="modal-container" style={{ margin: "0 auto" }}>
        <div className="modal">
          <h2>{isLogin ? "Iniciar sesión" : "Crear cuenta"}</h2>

          <form onSubmit={handleSubmit}>
            <label>Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />

            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
            />

            {(localError || authError) && (
              <p style={{ color: "#c0392b", marginTop: "10px" }}>
                {localError || authError}
              </p>
            )}

            <div className="modal-buttons">
              <button type="submit" className="primary-btn" disabled={isSubmitting}>
                {isSubmitting
                  ? "Enviando..."
                  : isLogin
                  ? "Iniciar sesión"
                  : "Crear cuenta"}
              </button>

              <button type="button" className="secondary-btn" onClick={switchMode}>
                {isLogin ? "Crear cuenta nueva" : "Ya tengo cuenta"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;