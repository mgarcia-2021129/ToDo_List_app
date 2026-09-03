import { createContext } from "react";

// Objeto de contexto puro, sin componentes ni hooks, para que
// AuthContext.jsx (el Provider) y useAuth.js (el hook) puedan importarlo
// por separado sin mezclar exports de componente y no-componente en el
// mismo archivo (regla react-refresh/only-export-components).
const AuthContext = createContext(null);

export default AuthContext;