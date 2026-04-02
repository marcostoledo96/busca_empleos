// Configuración del entorno de desarrollo.
// La URL base apunta al backend Express local.
//
// IMPORTANTE: Completar los valores de firebaseConfig con los datos
// del proyecto en https://console.firebase.google.com
// Project Settings → General → "Your apps" → Web app → firebaseConfig
export const environment = {
    produccion: false,
    urlApi: 'http://localhost:3000/api',
    firebaseConfig: {
        apiKey: 'AIzaSyB2Uah1Cg_gsfUFBYQAPbWX4PB-0LFlGYY',
        authDomain: 'busca-empleo-a4fbe.firebaseapp.com',
        projectId: 'busca-empleo-a4fbe',
        storageBucket: 'busca-empleo-a4fbe.firebasestorage.app',
        messagingSenderId: '962113157150',
        appId: '1:962113157150:web:028053b8e4c576dcad560f'
    }
};
