# Todo List App

## Nota

Este proyecto fue desarrollado como prueba técnica con el objetivo de demostrar la capacidad de diseñar, estructurar y desplegar una aplicación web fullstack aplicando buenas prácticas de desarrollo de software.

La solución contempla una arquitectura desacoplada entre frontend y backend, separación de responsabilidades, persistencia de datos y despliegue en un entorno de producción.

---

## Descripción del Proyecto

Todo List App es una aplicación web que permite la gestión de tareas mediante operaciones de creación, actualización, completado y eliminación.

La aplicación garantiza persistencia de datos mediante una base de datos MongoDB y está diseñada para ejecutarse tanto en entorno local como en producción.

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

- Routes: definición de endpoints
- Controllers: manejo de solicitudes HTTP
- Services: lógica de negocio
- Repositories: acceso a datos
- Models: definición de esquemas
- Middlewares: manejo global de errores

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

En entorno de desarrollo local, la base de datos se ejecuta dentro de un contenedor Docker utilizando Docker Compose.

En entorno de producción, se utiliza MongoDB Atlas como servicio administrado.

El acceso a datos se abstrae mediante una capa de repositorio, evitando el acoplamiento directo entre la lógica de negocio y la base de datos.

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

- Node.js versión 18 o superior
- Docker
- Cuenta en MongoDB Atlas (para producción)

### Entorno Local

1. Clonar el repositorio.
2. Configurar variables de entorno a partir del archivo `.env`.
3. Ejecutar Docker Compose para levantar base de datos y backend.
4. Iniciar el frontend en modo desarrollo.

Las instrucciones detalladas serán incluidas en la versión final del proyecto.

---

## Estado del Proyecto

En desarrollo.
