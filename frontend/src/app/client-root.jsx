"use client";

import React from "react";
import "../api/axiosConfig";
import { AuthProvider } from "../context/AuthContext";
import App from "../App";

export default function ClientRoot() {
  return (
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}