const { body, param } = require('express-validator');
const mongoose = require('mongoose');

const createTaskValidator = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Se requiere título')
        .isLength({ min: 3 })
        .withMessage('El título debe tener al menos 3 caracteres'),
];

const updateTaskValidator = [
    param('id')
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage('ID de Task no válido'),

    body('title')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('El título no puede estar vacío')
        .isLength({ min: 3 })
        .withMessage('El título debe tener al menos 3 caracteres'),

    body('completed')
        .optional()
        .isBoolean()
        .withMessage('Completado debe ser verdadero o falso'),
];

const idParamValidator = [
    param('id')
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage('ID de Task no válido'),
];

module.exports = {
    createTaskValidator,
    updateTaskValidator,
    idParamValidator,
};