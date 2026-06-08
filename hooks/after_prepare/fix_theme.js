const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const themesPath = path.join(context.opts.projectRoot, 'platforms/android/app/src/main/res/values/themes.xml');
    
    if (fs.existsSync(themesPath)) {
        let content = fs.readFileSync(themesPath, 'utf8');
        
        // Si no tiene la configuración de iconos oscuros, la inyectamos
        if (!content.includes('windowLightNavigationBar')) {
            // Forzamos el tema base a Light para garantizar compatibilidad
            content = content.replace(/parent="[^"]*"/, 'parent="Theme.AppCompat.Light.NoActionBar"');
            
            const itemsToAdd = `        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>
        <item name="android:statusBarColor">#FFFFFF</item>
        <item name="android:navigationBarColor">#FFFFFF</item>
        <item name="android:windowBackground">#FFFFFF</item>`;
            
            // Insertamos justo antes del cierre de la etiqueta style
            content = content.replace('</style>', itemsToAdd + '\n    </style>');
            fs.writeFileSync(themesPath, content, 'utf8');
            console.log('✅ TEMA NATIVO CORREGIDO: Iconos oscuros forzados en ambas barras.');
        }
    }
};