module.exports = function(ctx) {
    var fs = require('fs');
    var path = require('path');
    
    var buildGradlePath = path.join(ctx.opts.projectRoot, 'platforms', 'android', 'app', 'build.gradle');
    
    if (!fs.existsSync(buildGradlePath)) {
        console.log('No se encontró build.gradle');
        return;
    }
    
    var contenido = fs.readFileSync(buildGradlePath, 'utf8');
    var dependencia = "    implementation 'com.google.android.gms:play-services-ads:24.1.0'\n";
    
    if (contenido.includes('play-services-ads')) {
        console.log('Dependencia de AdMob ya existe');
        return;
    }
    
    // Insertar la dependencia en el bloque dependencies
    var regex = /(dependencies\s*\{[\s\S]*?)(\n\})/m;
    if (regex.test(contenido)) {
        contenido = contenido.replace(regex, "$1\n" + dependencia + "$2");
        fs.writeFileSync(buildGradlePath, contenido, 'utf8');
        console.log('Dependencia de AdMob agregada exitosamente');
    } else {
        console.log('No se pudo encontrar el bloque dependencies');
    }
};