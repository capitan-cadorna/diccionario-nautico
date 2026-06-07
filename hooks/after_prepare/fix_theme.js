const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const themesPath = path.join(context.opts.projectRoot, 'platforms/android/app/src/main/res/values/themes.xml');
    
    if (fs.existsSync(themesPath)) {
        let content = fs.readFileSync(themesPath, 'utf8');
        
        // Inyecta los atributos para iconos oscuros y fondo blanco si no existen
        if (!content.includes('windowLightStatusBar')) {
            content = content.replace(
                /(<style name="Theme\.App"[^>]*>)/,
                '$1\n        <item name="android:windowLightStatusBar">true</item>\n        <item name="android:windowLightNavigationBar">true</item>\n        <item name="android:statusBarColor">#FFFFFF</item>\n        <item name="android:navigationBarColor">#FFFFFF</item>'
            );
            fs.writeFileSync(themesPath, content, 'utf8');
            console.log('✅ Tema corregido: Iconos oscuros sobre fondo blanco aplicados.');
        }
    }
};