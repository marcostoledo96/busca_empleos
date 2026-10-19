// Evito leer archivos de entorno en los procesos sintéticos del runner.
const path = require('path');
require(path.resolve(__dirname, '../../node_modules/dotenv')).config = () => ({ parsed: {} });
