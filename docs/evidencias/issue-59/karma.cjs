// Mantengo Karma y Chrome sin acceso a destinos externos durante la validación sintética.
const path = require('node:path');
const cargar = require('node:module').createRequire(path.resolve(__dirname, '../../../frontend/package.json'));
// La ruta relativa evita superar el máximo de 108 bytes del socket Unix de Chrome en este worktree.
process.env.TMPDIR = '.angular';
module.exports = config => config.set({
    retryLimit: 0,
    frameworks: ['jasmine'],
    plugins: [cargar('karma-jasmine'), cargar('karma-chrome-launcher')],
    reporters: ['progress'],
    customLaunchers: {
        ChromeHeadlessIssue59: {
            base: 'ChromeHeadless',
            flags: ['--disable-background-networking', '--disable-dev-shm-usage',
                '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=localhost;127.0.0.1;[::1]',
                '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'],
        },
    },
});
