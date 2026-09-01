module.exports = {
  todoApi: {
    input: {
      target: '../backend/schema.yml',
    },
    output: {
      mode: 'split',
      target: 'src/api/generated/endpoints.ts',
      schemas: 'src/api/generated/models',
      client: 'axios-functions',
      clean: true,
    },
  },
};