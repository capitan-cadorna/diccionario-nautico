// =============================================
// CONFIGURACIÓN
// =============================================
const CONFIG = {
    dbName: 'diccionario',
    versionKey: 'db_version',
    versionActual: '6.43'
};

// =============================================
// VARIABLES GLOBALES
// =============================================
let db = null;
let historial = [];

// =============================================
// FUNCIÓN AUXILIAR PARA AMBAS BARRAS
// =============================================
async function configurarBarras(estiloStatus, colorStatus, colorNav, estiloNav) {
    const StatusBar = Capacitor.Plugins.StatusBar;
    const NavigationBar = Capacitor.Plugins.NavigationBar;

    // Sincronizamos el fondo del body con el de la barra
    document.body.style.backgroundColor = colorStatus;

    if (StatusBar) {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setStyle({ style: estiloStatus });
        await StatusBar.setBackgroundColor({ color: colorStatus });
    }

    if (NavigationBar) {
        try {
            await NavigationBar.setBackgroundColor({ color: colorNav });
            await NavigationBar.setBarStyle({ style: estiloNav });
        } catch (e) {
            console.warn('No se pudo configurar barra de navegación:', e);
        }
    }
}

// =============================================
// INICIALIZACIÓN (sql.js + barras)
// =============================================
document.addEventListener('deviceready', async () => {
    console.log('✅ Dispositivo listo (deviceready)');

    // Splash: iconos blancos, fondo azul (ambas barras)
    await configurarBarras('DARK', '#0a3b5a', '#0a3b5a', 'DARK');

    try {
        const SQL = await initSqlJs({
            locateFile: file => `js/${file}`
        });
        const savedDb = localStorage.getItem('diccionario_db');
        if (savedDb) {
            const arr = JSON.parse(savedDb);
            db = new SQL.Database(new Uint8Array(arr));
            console.log('✅ BD cargada desde almacenamiento');
        } else {
            db = new SQL.Database();
            console.log('✅ Nueva BD creada');
        }
        crearTabla();
        configurarUI();
        verificarYActualizar();
        mostrarInformacionSplash();

        // Guardar periódicamente
        setInterval(() => {
            const data = db.export();
            localStorage.setItem('diccionario_db', JSON.stringify(Array.from(data)));
        }, 30000);
    } catch (error) {
        console.error('❌ Error inicializando BD:', error);
        alert('Error al abrir la base de datos: ' + error.message);
    }
}, false);

function guardarBD() {
    if (db) {
        const data = db.export();
        localStorage.setItem('diccionario_db', JSON.stringify(Array.from(data)));
    }
}

function mostrarInformacionSplash() {
    var fecha = localStorage.getItem('diccionario_fecha') || '';
    var fechaElem = document.getElementById('fecha-actualizacion-splash');
    if (fechaElem && fecha) {
        fechaElem.textContent = '📅 Actualizado: ' + fecha;
    }

    setTimeout(() => {
        const result = db.exec('SELECT COUNT(*) as total FROM terminos');
        if (result.length > 0) {
            const total = result[0].values[0][0];
            console.log('📊 Total términos en BD: ' + total);
            var splashSubtitulo = document.querySelector('.splash-subtitulo');
            if (splashSubtitulo) {
                splashSubtitulo.textContent = total + ' términos náuticos en tu bolsillo';
            }
        }
    }, 1000);

    // Ocultar banner en el splash (función global definida en admob.js)
    if (window.ocultarBanner) window.ocultarBanner();
}

// =============================================
// BASE DE DATOS (sql.js)
// =============================================
function crearTabla() {
    db.run('CREATE TABLE IF NOT EXISTS terminos (id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT, definicion TEXT, categoria TEXT, titulo_busqueda TEXT)');
    console.log('✅ Tabla lista');
}

function insertarTerminos(terminos, callback) {
    db.run('DROP TABLE IF EXISTS terminos');
    crearTabla();
    const stmt = db.prepare('INSERT INTO terminos (titulo, definicion, categoria, titulo_busqueda) VALUES (?, ?, ?, ?)');
    let insertados = 0;
    terminos.forEach(t => {
        stmt.run([t.titulo, t.definicion, t.categoria || 'general', quitarAcentos(t.titulo.toLowerCase())]);
        insertados++;
    });
    stmt.free();
    guardarBD();
    console.log('✅ ' + insertados + ' términos guardados');
    localStorage.setItem(CONFIG.versionKey, CONFIG.versionActual);
    if (callback) callback(insertados);
}

function buscarTerminos(texto, callback) {
    const busqueda = '%' + quitarAcentos(texto.toLowerCase()) + '%';
    const results = db.exec('SELECT * FROM terminos WHERE titulo_busqueda LIKE ? ORDER BY titulo ASC LIMIT 50', [busqueda]);
    const resultados = [];
    if (results.length > 0 && results[0].values) {
        results[0].values.forEach(row => {
            resultados.push({ id: row[0], titulo: row[1], definicion: row[2], categoria: row[3] });
        });
    }
    callback(resultados);
}

function buscarTerminoExacto(texto, callback) {
    // 1. Limpiamos el texto: minúsculas, quitamos espacios extra y reemplazamos guiones por espacios
    var busqueda = texto.toLowerCase().trim().replace(/-/g, ' ');

    // 2. Intento de búsqueda exacta
    const results = db.exec('SELECT * FROM terminos WHERE LOWER(titulo) = ? LIMIT 1', [busqueda]);
    if (results.length > 0 && results[0].values.length > 0) {
        const row = results[0].values[0];
        callback({ id: row[0], titulo: row[1], definicion: row[2], categoria: row[3] });
        return;
    }

    // 3. Intento de búsqueda sin acentos (más flexible)
    var busquedaSinAcentos = quitarAcentos(busqueda);
    const all = db.exec('SELECT * FROM terminos');
    if (all.length > 0) {
        const valores = all[0].values;

        // Buscamos coincidencia exacta ignorando acentos
        for (let i = 0; i < valores.length; i++) {
            var term = valores[i];
            var tituloSinAcentos = quitarAcentos(term[1].toLowerCase());
            if (tituloSinAcentos === busquedaSinAcentos) {
                callback({ id: term[0], titulo: term[1], definicion: term[2], categoria: term[3] });
                return;
            }
        }

        // Si aún no se encuentra, intentamos con una búsqueda parcial (empezando por...)
        var raiz = busquedaSinAcentos.substring(0, Math.min(6, busquedaSinAcentos.length));
        for (let j = 0; j < valores.length; j++) {
            var term2 = valores[j];
            var tituloSinAcentos2 = quitarAcentos(term2[1].toLowerCase());
            if (tituloSinAcentos2.indexOf(raiz) === 0) {
                callback({ id: term2[0], titulo: term2[1], definicion: term2[2], categoria: term2[3] });
                return;
            }
        }
    }

    // 4. Último recurso: búsqueda LIKE general
    buscarTerminos(busqueda, function(resultados) {
        if (resultados.length > 0) callback(resultados[0]);
        else callback(null);
    });
}

function quitarAcentos(texto) {
    var mapa = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u', 'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ü': 'u', 'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u' };
    return texto.replace(/[áéíóúàèìòùäëïöüâêîôû]/g, letra => mapa[letra] || letra);
}

// =============================================
// CARGA DEL JSON LOCAL
// =============================================
function verificarYActualizar() {
    var versionLocal = localStorage.getItem(CONFIG.versionKey) || '0';
    var fechaLocal = localStorage.getItem('diccionario_fecha') || '';

    var splashFecha = document.getElementById('fecha-actualizacion-splash');
    if (splashFecha) {
        splashFecha.textContent = (!fechaLocal || fechaLocal === '0') ? '📅 Diccionario precargado' : '📅 Actualizado: ' + fechaLocal;
    }
    var fechaElem = document.getElementById('fecha-actualizacion');
    if (fechaElem) {
        fechaElem.textContent = (!fechaLocal || fechaLocal === '0') ? '📅 Diccionario precargado' : '📅 Actualizado: ' + fechaLocal;
    }

    if (versionLocal !== CONFIG.versionActual) {
        fetch('js/diccionario_data.json')
            .then(response => response.json())
            .then(data => {
                insertarTerminos(data, function(total) {
                    var fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    localStorage.setItem(CONFIG.versionKey, CONFIG.versionActual);
                    localStorage.setItem('diccionario_fecha', fechaHoy);
                    if (splashFecha) splashFecha.textContent = '📅 Actualizado: ' + fechaHoy;
                    if (fechaElem) fechaElem.textContent = '📅 Actualizado: ' + fechaHoy;
                    mostrarInformacionSplash();
                });
            })
            .catch(error => console.error('❌ Error al cargar JSON:', error));
    }
}

// =============================================
// INTERFAZ
// =============================================
function formatearDefinicion(texto) {
    texto = texto.replace(/\[\[WEB:([^|]+)\|([^\]]+)\]\]/g, (m, url, term) => '<span class="enlace-web" data-url="' + url + '">' + term + '</span>');
    texto = texto.replace(/\[\[([^|]+)\|([^\]]+)\]\]/g, (m, slug, term) => '<span class="enlace-term" data-term="' + slug + '">' + term + '</span>');
    return texto;
}

function mostrarDetalle(term, guardarEnHistorial) {
    if (guardarEnHistorial !== false) {
        var tituloActual = document.getElementById('detalle-titulo').textContent;
        if (tituloActual && tituloActual !== term.titulo && tituloActual !== 'Término') {
            historial.push({
                titulo: tituloActual,
                definicion: document.getElementById('detalle-definicion').innerHTML
            });
        }
    }

    document.getElementById('busqueda').style.display = 'none';
    document.getElementById('resultados').style.display = 'none';
    document.getElementById('detalle').style.display = 'block';
    document.getElementById('detalle-titulo').textContent = term.titulo;
    document.getElementById('detalle-definicion').innerHTML = formatearDefinicion(term.definicion);

    var enlaces = document.querySelectorAll('#detalle-definicion .enlace-term');
    for (var i = 0; i < enlaces.length; i++) {
        enlaces[i].addEventListener('click', function() {
            var terminoBuscado = this.getAttribute('data-term');
            buscarTerminoExacto(terminoBuscado, function(termEncontrado) {
                if (termEncontrado) mostrarDetalle(termEncontrado);
                else alert('Término no encontrado: ' + terminoBuscado);
            });
        });
    }

    var enlacesWeb = document.querySelectorAll('#detalle-definicion .enlace-web');
    for (var j = 0; j < enlacesWeb.length; j++) {
        enlacesWeb[j].addEventListener('click', function() {
            var url = this.getAttribute('data-url');
            if (Capacitor.Plugins.Browser) {
                Capacitor.Plugins.Browser.open({ url: url });
            } else {
                window.open(url, '_blank');
            }
        });
    }
}

function configurarUI() {
    // Ocultar banner al enfocar cualquier input y mostrarlo al salir
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            if (window.ocultarBanner) window.ocultarBanner();
        });
        input.addEventListener('blur', () => {
            // Pequeño retardo para evitar parpadeos si se cambia de un input a otro
            setTimeout(() => {
                if (document.activeElement.tagName !== 'INPUT') {
                    if (document.getElementById('splash').style.display === 'none') {
                        if (window.mostrarBanner) window.mostrarBanner();
                    }
                }
            }, 300);
        });
    });

    document.getElementById('input-buscar').addEventListener('input', function() {
        const texto = this.value.trim();
        if (texto.length < 2) {
            document.getElementById('lista-resultados').innerHTML = '<li><em>Escribe al menos 2 letras</em></li>';
            return;
        }
        buscarTerminos(texto, function(resultados) {
            const lista = document.getElementById('lista-resultados');
            lista.innerHTML = '';
            if (resultados.length === 0) {
                lista.innerHTML = '<li><em>Sin resultados</em></li>';
                return;
            }
            resultados.forEach(function(term) {
                const li = document.createElement('li');
                li.textContent = term.titulo;
                li.addEventListener('click', function() {
                    historial = [];
                    buscarTerminoExacto(term.titulo, function(termEncontrado) {
                        if (termEncontrado) {
                            mostrarDetalle(termEncontrado, false);
                        }
                    });
                });
                lista.appendChild(li);
            });
        });
    });

    document.getElementById('btn-volver').addEventListener('click', function() {
        if (historial.length > 0) {
            var terminoAnterior = historial.pop();
            document.getElementById('detalle-titulo').textContent = terminoAnterior.titulo;
            document.getElementById('detalle-definicion').innerHTML = terminoAnterior.definicion;

            var enlaces = document.querySelectorAll('#detalle-definicion .enlace-term');
            for (var i = 0; i < enlaces.length; i++) {
                enlaces[i].addEventListener('click', function() {
                    var terminoBuscado = this.getAttribute('data-term');
                    buscarTerminoExacto(terminoBuscado, function(termEncontrado) {
                        if (termEncontrado) mostrarDetalle(termEncontrado);
                        else alert('Término no encontrado: ' + terminoBuscado);
                    });
                });
            }
        } else {
            document.getElementById('detalle').style.display = 'none';
            document.getElementById('busqueda').style.display = 'block';
            document.getElementById('resultados').style.display = 'block';
        }
    });

    document.getElementById('btn-home').addEventListener('click', function() {
        historial = [];
        document.getElementById('detalle').style.display = 'none';
        document.getElementById('busqueda').style.display = 'block';
        document.getElementById('resultados').style.display = 'block';
        document.getElementById('input-buscar').value = '';
        document.getElementById('input-buscar-detalle').value = '';
        document.getElementById('lista-resultados').innerHTML = '<li><em>Escribe algo en el buscador...</em></li>';
    });

    document.getElementById('input-buscar-detalle').addEventListener('input', function() {
        const texto = this.value.trim();
        var listaAnterior = document.getElementById('sugerencias-detalle');
        if (listaAnterior) listaAnterior.remove();
        if (texto.length < 2) return;

        buscarTerminos(texto, function(resultados) {
            if (resultados.length === 0) return;
            var lista = document.createElement('ul');
            lista.id = 'sugerencias-detalle';
            lista.style.cssText = 'position:absolute; top:100%; left:0; right:0; background:white; border:1px solid #ccc; border-radius:8px; list-style:none; padding:0; margin:5px 0 0 0; max-height:200px; overflow-y:auto; z-index:9999; box-shadow:0 4px 8px rgba(0,0,0,0.1);';

            resultados.forEach(function(term) {
                var li = document.createElement('li');
                li.textContent = term.titulo;
                li.style.cssText = 'padding:10px 15px; cursor:pointer; border-bottom:1px solid #eee;';
                li.addEventListener('click', function() {
                    lista.remove();
                    document.getElementById('input-buscar-detalle').value = '';
                    mostrarDetalle(term);
                });
                lista.appendChild(li);
            });

            var inputDetalle = document.getElementById('input-buscar-detalle');
            inputDetalle.parentNode.style.position = 'relative';
            inputDetalle.parentNode.appendChild(lista);
        });
    });

    document.addEventListener('click', function(e) {
        if (e.target.id !== 'input-buscar-detalle') {
            var lista = document.getElementById('sugerencias-detalle');
            if (lista) lista.remove();
        }
    });
}

// =============================================
// DICCIONARIO TRILINGÜE
// =============================================
let datosTrilingues = [];

function cargarDiccionarioTrilingue() {
    fetch('js/trilingue_data.json')
        .then(response => response.json())
        .then(data => {
            datosTrilingues = data;
            console.log('🌍 ' + data.length + ' términos trilingües cargados');
        })
        .catch(error => console.error('❌ Error trilingüe:', error));
}

function buscarTrilingue(texto) {
    const busqueda = quitarAcentos(texto.toLowerCase());
    return datosTrilingues.filter(function(entrada) {
        for (var clave in entrada) {
            if (quitarAcentos(entrada[clave].toLowerCase()).indexOf(busqueda) !== -1) return true;
        }
        return false;
    }).slice(0, 30);
}

function mostrarResultadosTrilingue(resultados) {
    var contenedor = document.getElementById('resultado-triligue');
    if (resultados.length === 0) {
        contenedor.innerHTML = '<p style="color:#888;text-align:center;margin-top:30px;">No se encontraron resultados</p>';
        return;
    }
    var html = '';
    var cabeceras = Object.keys(resultados[0]);
    resultados.forEach(function(entrada) {
        html += '<div class="tarjeta-triligue">';
        cabeceras.forEach(function(clave) {
            html += '<div class="fila-triligue">';
            html += '<span class="etiqueta-triligue">' + clave + ':</span> ';
            html += '<span class="valor-triligue">' + entrada[clave] + '</span>';
            html += '</div>';
        });
        html += '</div>';
    });
    contenedor.innerHTML = html;
}

document.getElementById('input-buscar-triligue').addEventListener('input', function() {
    var texto = this.value.trim();
    if (texto.length < 2) {
        document.getElementById('resultado-triligue').innerHTML = '<p class="placeholder-triligue">Escribe al menos 2 letras para buscar</p>';
        return;
    }
    mostrarResultadosTrilingue(buscarTrilingue(texto));
});

// =============================================
// NAVEGACIÓN DESDE EL SPLASH
// =============================================
document.getElementById('btn-diccionario').addEventListener('click', function() {
    document.getElementById('splash').style.display = 'none';
    configurarBarras('DARK', '#0a3b5a', '#0a3b5a', 'DARK');
    document.getElementById('enlaces-externos').style.display = 'none';
    document.getElementById('trilingue').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('busqueda').style.display = 'block';
    document.getElementById('resultados').style.display = 'block';
    document.getElementById('detalle').style.display = 'none';
    document.querySelector('#app > header').style.display = 'block';
    if (window.mostrarBanner) window.mostrarBanner();
});

document.getElementById('btn-triligue-splash').addEventListener('click', function() {
    document.getElementById('splash').style.display = 'none';
    configurarBarras('DARK', '#0a3b5a', '#0a3b5a', 'DARK');
    document.getElementById('enlaces-externos').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('busqueda').style.display = 'none';
    document.getElementById('resultados').style.display = 'none';
    document.getElementById('detalle').style.display = 'none';
    document.getElementById('trilingue').style.display = 'block';
    document.querySelector('#app > header').style.display = 'none';
    if (window.mostrarBanner) window.mostrarBanner();
});

document.getElementById('btn-enlaces').addEventListener('click', function() {
    document.getElementById('splash').style.display = 'none';
    configurarBarras('DARK', '#0a3b5a', '#0a3b5a', 'DARK');
    document.getElementById('app').style.display = 'none';
    document.getElementById('trilingue').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'block';
    if (window.mostrarBanner) window.mostrarBanner();
});

document.querySelectorAll('.enlace-ext').forEach(function(enlace) {
    enlace.addEventListener('click', function(e) {
        e.preventDefault();
        var url = this.getAttribute('href');
        if (Capacitor.Plugins.Browser) {
            Capacitor.Plugins.Browser.open({ url: url });
        } else {
            window.open(url, '_blank');
        }
    });
});

cargarDiccionarioTrilingue();

// =============================================
// MENÚ HAMBURGUESA
// =============================================
document.addEventListener('click', function(e) {
    if (e.target.closest('#btn-menu')) {
        e.stopPropagation();
        var menu = e.target.closest('header').querySelector('#menu-desplegable');
        if (menu) {
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        }
        return;
    }
    document.querySelectorAll('#menu-desplegable').forEach(function(m) {
        m.style.display = 'none';
    });
});

function asignarMenu(id, accion) {
    document.querySelectorAll('#' + id).forEach(function(el) {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            document.querySelectorAll('#menu-desplegable').forEach(function(m) {
                m.style.display = 'none';
            });
            accion();
        });
    });
}

// 🏠 Inicio (volver al splash)
asignarMenu('menu-inicio', function() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'none';
    document.getElementById('trilingue').style.display = 'none';
    document.getElementById('splash').style.display = 'flex';
    document.querySelector('#app > header').style.display = 'block';
    configurarBarras('DARK', '#0a3b5a', '#0a3b5a', 'DARK');
    if (window.ocultarBanner) window.ocultarBanner();
});

// 📖 Diccionario Náutico
asignarMenu('menu-diccionario', function() {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'none';
    document.getElementById('trilingue').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('busqueda').style.display = 'block';
    document.getElementById('resultados').style.display = 'block';
    document.getElementById('detalle').style.display = 'none';
    document.querySelector('#app > header').style.display = 'block';
    configurarBarras('DARK', '#0a3b5a', '#0a3b5a', 'DARK');
    if (window.mostrarBanner) window.mostrarBanner();
});

// 🌍 Diccionario Trilingüe
asignarMenu('menu-triligue', function() {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('busqueda').style.display = 'none';
    document.getElementById('resultados').style.display = 'none';
    document.getElementById('detalle').style.display = 'none';
    document.getElementById('trilingue').style.display = 'block';
    document.querySelector('#app > header').style.display = 'none';
    configurarBarras('DARK', '#0a3b5a', '#0a3b5a', 'DARK');
    if (window.mostrarBanner) window.mostrarBanner();
});

// 🔗 Enlaces Externos
asignarMenu('menu-enlaces', function() {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('trilingue').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'block';
    configurarBarras('DARK', '#0a3b5a', '#0a3b5a', 'DARK');
    if (window.mostrarBanner) window.mostrarBanner();
});

// 📤 Compartir app
asignarMenu('menu-compartir', function() {
    var mensaje = 'Descubre el Diccionario Náutico. Más de 2.000 términos sin conexión. ¡Descárgala gratis! ⚓';
    var enlace = 'https://play.google.com/store/apps/details?id=ar.com.diccionario_nautico';
    if (Capacitor.Plugins.Share) {
        Capacitor.Plugins.Share.share({
            title: 'Diccionario Náutico',
            text: mensaje,
            url: enlace
        });
    } else {
        alert('📤 ' + mensaje + '\n\n' + enlace);
    }
});

// ℹ️ Acerca de
asignarMenu('menu-acerca', function() {
    if (Capacitor.Plugins.App) {
        Capacitor.Plugins.App.getInfo().then(function(info) {
            var mensaje = '⚓ Diccionario Náutico\n\nVersión: ' + info.version +
                          '\n\nDesarrollado por Nautiapps\ndiccionario-nautico.com.ar\n\n© ' + new Date().getFullYear();
            if (Capacitor.Plugins.Dialog) {
                Capacitor.Plugins.Dialog.alert({
                    title: 'Acerca de',
                    message: mensaje,
                    buttonTitle: 'Cerrar'
                });
            } else {
                alert(mensaje);
            }
        }).catch(function() {
            alert('⚓ Diccionario Náutico\n\nVersión: 1.0.8\n\nDesarrollado por Nautiapps\ndiccionario-nautico.com.ar');
        });
    } else {
        alert('⚓ Diccionario Náutico\n\nVersión: 1.0.8\n\nDesarrollado por Nautiapps\ndiccionario-nautico.com.ar');
    }
});

// Títulos "Diccionario Náutico" como botón Volver al splash
document.querySelectorAll('#volver-al-inicio, #volver-al-splash, #volver-al-inicio-triligue').forEach(function(el) {
    el.addEventListener('click', function() {
        document.querySelectorAll('#menu-desplegable').forEach(function(m) {
            m.style.display = 'none';
        });
        document.getElementById('app').style.display = 'none';
        document.getElementById('enlaces-externos').style.display = 'none';
        document.getElementById('trilingue').style.display = 'none';
        document.getElementById('splash').style.display = 'flex';
        document.querySelector('#app > header').style.display = 'block';
        configurarBarras('DARK', '#0a3b5a', '#0a3b5a', 'DARK');
        if (window.ocultarBanner) window.ocultarBanner();
    });
});