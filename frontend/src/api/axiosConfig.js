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

axios.defaults.baseURL = import.meta.env.VITE_API_URL;

export default axios;