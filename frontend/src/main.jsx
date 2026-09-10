import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import "./api/axiosConfig";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { store } from "./store/store";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </Provider>
);