// Impido que suites legacy consulten archivos de entorno durante la verificación focal.
jest.mock('dotenv', () => ({ config: jest.fn(() => ({ parsed: {} })) }));
