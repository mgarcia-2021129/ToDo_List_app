# Todo List App

## Nota

Este proyecto fue desarrollado como prueba técnica con el objetivo de demostrar la capacidad de diseñar, estructurar y desplegar una aplicación web fullstack aplicando buenas prácticas de desarrollo de software.

La solución contempla una arquitectura desacoplada entre frontend y backend, separación de responsabilidades, persistencia de datos y despliegue en un entorno de producción.

---

### Demo

La aplicación se encuentra desplegada y puede probarse directamente desde el navegador.

Frontend

https://todo-frontend-65nh.onrender.com

Backend API

https://todo-backend-j9lo.onrender.com

Ejemplo de endpoint:

GET /api/tasks

URL completa:

https://todo-backend-j9lo.onrender.com/api/tasks

La API puede ser consumida mediante herramientas como Postman o directamente desde el frontend desplegado.

---

## Descripción del Proyecto

Todo List App es una aplicación web que permite la gestión de tareas mediante operaciones de:

- Crear tareas
- Actualizar tareas
- Marcar tareas como completadas
- Eliminar tareas

La aplicación garantiza persistencia de datos mediante MongoDB y está diseñada para ejecutarse tanto en entorno local como en producción.

El enfoque principal del proyecto es demostrar:

- Organización estructural del código
- Aplicación de arquitectura por capas
- Separación clara entre lógica de negocio y acceso a datos
- Uso de principios SOLID
- Implementación de pruebas unitarias
- Configuración de entorno con contenedores
- Despliegue en servicios de hosting gratuitos

---

## Arquitectura General

La aplicación está compuesta por dos componentes principales:

### Backend

API REST desarrollada en Node.js con Express, organizada bajo una arquitectura por capas:

- config: configuración de la base de datos y variables de entorno
- controllers: manejo de solicitudes HTTP
- middlewares: manejo de errores y validaciones globales
- models: definición de esquemas de datos
- routes: definición de endpoints
- validators: validaciones de datos de entrada

Además, los tests se encuentran en la carpeta tests a nivel de backend.

Esta estructura favorece la mantenibilidad, escalabilidad y claridad del código.

### Frontend

Aplicación desarrollada en React utilizando Vite como herramienta de construcción.

La interfaz permite:

- Visualización de tareas
- Creación y edición mediante modal
- Filtrado por estado
- Marcado de tareas como completadas
- Eliminación de tareas

La estructura del frontend mantiene separación entre:

- Componentes
- Servicios de consumo de API
- Hooks personalizados
- Estilos

---

## Gestión de Datos

La persistencia se realiza mediante MongoDB.

Desarrollo Local

En entorno local, la base de datos se ejecuta utilizando Docker Compose, lo que permite levantar todos los servicios necesarios con un solo comando.

Producción

En producción, la base de datos está desplegada en MongoDB Atlas, un servicio administrado en la nube que permite mantener la persistencia de datos de forma segura y escalable.

---

## Tecnologías Utilizadas

### Backend

- Node.js
- Express
- MongoDB
- Mongoose
- Jest para pruebas unitarias

### Frontend

- React
- Vite
- CSS

### Infraestructura

- Docker Compose (entorno local)
- Render (despliegue en producción)
- MongoDB Atlas (base de datos en producción)

---

## Estructura del Repositorio

El proyecto está organizado como monorepo:

```
/backend
/frontend
```

Cada carpeta contiene su propia configuración, dependencias y estructura interna.

---

## Instalación y Ejecución

### Requisitos Previos

Antes de ejecutar el proyecto se debe tener instalado:

- Node.js v20.20.0
- npm v10.8.2
- Docker
- Docker Compose
- MongoDB Compass
- Git

1. Clonar el repositorio
2. Configurar variables de entorno

El proyecto utiliza archivos .env para la configuración de variables de entorno.

Cada servicio incluye un archivo .env.example como referencia.

### Backend

En la carpeta backend crear un archivo .env utilizando como base .env.example.

Ejemplo:

PORT=5000

MONGO_URI=mongodb://mongo:27017/todo_db

### Frontend

En la carpeta frontend crear un archivo .env utilizando como base .env.example.

Ejemplo:

VITE_API_URL=http://localhost:5000

### Ejecución en Entorno Local

Una vez configuradas las variables de entorno, ejecutar desde la raiz del proyecto:

docker compose up --build

<img width="376" height="17" alt="image" src="https://github.com/user-attachments/assets/98f5913c-cf79-4195-8a36-4c9961567591" />

Este comando levantará automáticamente:

- Base de datos MongoDB
- Backend (API REST)
- Frontend (React)

Una vez iniciados los contenedores, la aplicación estará disponible en:

Frontend
http://localhost:5173

Backend API
http://localhost:5000

### Exploración mediante MongoDB Compass

Pasos básicos:

1. Abrir MongoDB Compass.
2. Seleccionar New Connection.
3. Pegar la cadena de conexión de MongoDB. (mongodb://localhost:27018/)
4. Haz clic en Connect.

endpoints del API

- GET http://localhost:5000/api/tasks
- POST http://localhost:5000/api/tasks
- PUT http://localhost:5000/api/tasks/:id
- DELETE http://localhost:5000/api/tasks/:id

### Cómo ver la base de datos del proyecto en MongoDB Atlas
1. Abrir MongoDB Compass.
2. Seleccionar New Connection.
3. Pegar la cadena de conexión de MongoDB Atlas. (mongodb+srv://reader:reader@cluster0.0zlfvw1.mongodb.net/?appName=Cluster0)
4. Haz clic en Connect.

---

### Pruebas

El proyecto incluye pruebas unitarias utilizando Jest.

Para ejecutarlas:

cd backend
npm test

---

## Estado del Proyecto

Proyecto finalizado y desplegado en entorno de producción.

---

## Autor

Manuel Antonio Garcia Juárez
