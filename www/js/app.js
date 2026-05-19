// =============================================
// CONFIGURACIÓN
// =============================================
const CONFIG = {
    dbName: 'diccionario.db',
    versionKey: 'db_version',
    versionActual: '4.86',
    apiToken: 'dWfh45T2y6htfdhGdrry'
};

// =============================================
// VARIABLES GLOBALES
// =============================================
let db = null;
let historial = [];
let datosTrilingues = [];

// =============================================
// INICIALIZACIÓN
// =============================================
document.addEventListener('deviceready', onDeviceReady, false);

// Fallback: si deviceready no se dispara en 3 segundos, ejecutar igual
setTimeout(function() {
    if (!window._deviceReadyCalled) {
        alert('⚠️ deviceready NO se disparó. Ejecutando manualmente...');
        onDeviceReady();
    }
}, 3000);

function onDeviceReady() {
    console.log('✅ Dispositivo listo');

    // --- FUNCIÓN VOLVER AL SPLASH ---
    function volverAlSplash() {
        document.getElementById('enlaces-externos').style.display = 'none';
        document.getElementById('app').style.display = 'none';
        document.getElementById('splash').style.display = 'flex';
    }

    // --- CONFIGURAR NAVEGACIÓN DEL SPLASH ---
    function configurarNavegacionSplash() {
        // Botón Diccionario Náutico
        document.getElementById('btn-diccionario').addEventListener('click', function() {
            document.getElementById('splash').style.display = 'none';
            document.getElementById('enlaces-externos').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            document.getElementById('busqueda').style.display = 'block';
            document.getElementById('resultados').style.display = 'block';
            document.getElementById('detalle').style.display = 'none';
            document.getElementById('trilingue').style.display = 'none';
        });

        // Botón Diccionario Trilingüe
        document.getElementById('btn-triligue-splash').addEventListener('click', function() {
            document.getElementById('splash').style.display = 'none';
            document.getElementById('enlaces-externos').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            document.getElementById('busqueda').style.display = 'none';
            document.getElementById('resultados').style.display = 'none';
            document.getElementById('detalle').style.display = 'none';
            document.getElementById('trilingue').style.display = 'block';
        });

        // Botón Enlaces Externos
        document.getElementById('btn-enlaces').addEventListener('click', function() {
            document.getElementById('splash').style.display = 'none';
            document.getElementById('app').style.display = 'none';
            document.getElementById('trilingue').style.display = 'none';
            document.getElementById('enlaces-externos').style.display = 'block';
        });

        // Volver desde Enlaces Externos
        document.getElementById('btn-volver-splash').addEventListener('click', volverAlSplash);

        // Enlaces externos → abrir navegador
        document.querySelectorAll('.enlace-ext').forEach(function(enlace) {
            enlace.addEventListener('click', function(e) {
                e.preventDefault();
                var url = this.getAttribute('href');
                if (typeof cordova !== 'undefined' && cordova.InAppBrowser) {
                    cordova.InAppBrowser.open(url, '_system');
                } else {
                    window.open(url, '_blank');
                }
            });
        });

        // Título "Enlaces Externos" también vuelve al splash
        document.getElementById('titulo-header-enlaces')?.addEventListener('click', volverAlSplash);

        // Volver al Splash desde el header del diccionario
        var btnHome = document.getElementById('btn-volver-splash-header');
        if (btnHome) {
            btnHome.addEventListener('click', function() {
                document.getElementById('app').style.display = 'none';
                document.getElementById('splash').style.display = 'flex';
            });
        }
    }

    window._deviceReadyCalled = true;

    // Abrir base de datos
    db = window.sqlitePlugin.openDatabase({
        name: CONFIG.dbName,
        location: 'default'
    });

    crearTabla();

    // Cargar datos del diccionario principal
    fetch('js/diccionario_data.json')
        .then(function(response) { return response.json(); })
        .then(function(data) {
            insertarTerminos(data, function(total) {
                console.log('✅ ' + total + ' términos guardados');
                // Configurar UI y enlaces cuando los datos estén listos
                configurarUI();
                configurarTitulosCliqueables();
            });
        })
        .catch(function(error) {
            console.error('❌ Error JSON:', error);
        });

    // Cargar datos del trilingüe
    fetch('js/trilingue_data.json')
        .then(function(response) { return response.json(); })
        .then(function(data) {
            window.datosTrilingues = data;
            datosTrilingues = data;
            console.log('🌍 Trilingüe cargado: ' + data.length + ' términos');
            // Configurar buscador del trilingüe cuando los datos estén listos
            configurarTrilingue();
        })
        .catch(function(error) {
            console.error('❌ Error trilingüe:', error);
        });

    // Inicializar componentes que no dependen de datos
    initAdMob();
    configurarNavegacionSplash();
}

// =============================================
// BASE DE DATOS
// =============================================
function crearTabla() {
    db.executeSql(
        'CREATE TABLE IF NOT EXISTS terminos (id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT, definicion TEXT, categoria TEXT)',
        [],
        function() { console.log('✅ Tabla lista'); },
        function(error) { console.error('❌ Error tabla:', error); }
    );
}

function insertarTerminos(terminos, callback) {
    let insertados = 0;
    db.transaction(function(tx) {
        tx.executeSql('DELETE FROM terminos');
        terminos.forEach(function(t) {
            tx.executeSql(
                'INSERT INTO terminos (titulo, definicion, categoria) VALUES (?, ?, ?)',
                [t.titulo, t.definicion, t.categoria || 'general'],
                function() { insertados++; },
                function(tx, error) { console.error('❌ Insert:', error.message); }
            );
        });
    }, function(error) {
        console.error('❌ Transacción:', error);
    }, function() {
        console.log('✅ ' + insertados + ' términos guardados');
        localStorage.setItem(CONFIG.versionKey, CONFIG.versionActual);
        if (callback) callback(insertados);
    });
}

function buscarTerminos(texto, callback) {
    const busqueda = '%' + texto.toLowerCase() + '%';
    db.executeSql(
        'SELECT * FROM terminos WHERE LOWER(titulo) LIKE ? ORDER BY titulo ASC LIMIT 50',
        [busqueda],
        function(rs) {
            const resultados = [];
            for (let i = 0; i < rs.rows.length; i++) {
                resultados.push(rs.rows.item(i));
            }
            callback(resultados);
        },
        function(error) {
            console.error('❌ Búsqueda:', error);
            callback([]);
        }
    );
}

function buscarTerminoExacto(texto, callback) {
    db.executeSql(
        'SELECT * FROM terminos WHERE LOWER(titulo) = ? LIMIT 1',
        [texto.toLowerCase()],
        function(rs) {
            if (rs.rows.length > 0) {
                callback(rs.rows.item(0));
                return;
            }
            
            // Intentar quitando última letra (plurales)
            var textoSinUltima = texto.slice(0, -1);
            db.executeSql(
                'SELECT * FROM terminos WHERE LOWER(titulo) = ? LIMIT 1',
                [textoSinUltima.toLowerCase()],
                function(rs2) {
                    if (rs2.rows.length > 0) {
                        callback(rs2.rows.item(0));
                    } else {
                        buscarTerminos(texto, function(resultados) {
                            callback(resultados.length > 0 ? resultados[0] : null);
                        });
                    }
                },
                function() { callback(null); }
            );
        },
        function(error) {
            console.error('Error:', error);
            callback(null);
        }
    );
}

// =============================================
// FORMATEO DE DEFINICIONES
// =============================================
function formatearDefinicion(texto) {
    // Limpiar marcadores rotos del exportador
    texto = texto.replace(/\[\[([^\]]+?)"\]\]/g, '[[$1]]');
    texto = texto.replace(/\[\[([^\]]+?)">/g, '[[');
    texto = texto.replace(/"\]\]/g, ']]');
    
    // Formato compuesto: [[término_real|texto_visible]]
    texto = texto.replace(/\[\[([^|]+)\|([^\]]+)\]\]/g, function(match, term, display) {
        return '<span class="enlace-term" data-term="' + term.trim() + '">' + display.trim() + '</span>';
    });
    
    // Formato simple: [[término]]
    texto = texto.replace(/\[\[([^\]]+)\]\]/g, function(match, term) {
        term = term.trim();
        if (term.length === 0) return '';
        if (term.indexOf('http') === 0) {
            return '<span class="enlace-web" data-url="' + term + '">' + term + '</span>';
        }
        return '<span class="enlace-term" data-term="' + term + '">' + term + '</span>';
    });
    
    // Enlaces web externos: [[WEB:url|texto]]
    texto = texto.replace(/\[\[WEB:([^|]+)\|([^\]]+)\]\]/g, function(match, url, display) {
        return '<span class="enlace-web" data-url="' + url.trim() + '">' + display.trim() + '</span>';
    });
    
    return texto;
}

// =============================================
// ASIGNAR EVENTOS A ENLACES EN DEFINICIONES
// =============================================
function asignarEventosEnlaces() {
    // Enlaces internos
    document.querySelectorAll('#detalle-definicion .enlace-term').forEach(function(enlace) {
        enlace.addEventListener('click', function() {
            var terminoBuscado = this.getAttribute('data-term');
            buscarTerminoExacto(terminoBuscado, function(termEncontrado) {
                if (termEncontrado) {
                    mostrarDetalle(termEncontrado);
                } else {
                    alert('Término no encontrado: ' + terminoBuscado);
                }
            });
        });
    });
    
    // Enlaces web externos
    document.querySelectorAll('#detalle-definicion .enlace-web').forEach(function(enlace) {
        enlace.addEventListener('click', function() {
            var url = this.getAttribute('data-url');
            if (typeof cordova !== 'undefined' && cordova.InAppBrowser) {
                cordova.InAppBrowser.open(url, '_system');
            } else {
                window.open(url, '_blank');
            }
        });
    });
}

// =============================================
// MOSTRAR DETALLE
// =============================================
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
    
    asignarEventosEnlaces();
}

// =============================================
// CONFIGURAR UI PRINCIPAL
// =============================================
function configurarUI() {
    // Buscador principal
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
                        } else {
                            alert('Término no encontrado: ' + term.titulo);
                        }
                    });
                });
                lista.appendChild(li);
            });
        });
    });
    
    // Botón Volver (historial)
    document.getElementById('btn-volver').addEventListener('click', function() {
        if (historial.length > 0) {
            var terminoAnterior = historial.pop();
            document.getElementById('detalle-titulo').textContent = terminoAnterior.titulo;
            document.getElementById('detalle-definicion').innerHTML = terminoAnterior.definicion;
            asignarEventosEnlaces();
        } else {
            document.getElementById('detalle').style.display = 'none';
            document.getElementById('busqueda').style.display = 'block';
            document.getElementById('resultados').style.display = 'block';
        }
    });
    
    // Botón Home (inicio de búsqueda)
    document.getElementById('btn-home').addEventListener('click', function() {
        historial = [];
        document.getElementById('detalle').style.display = 'none';
        document.getElementById('busqueda').style.display = 'block';
        document.getElementById('resultados').style.display = 'block';
        document.getElementById('input-buscar').value = '';
        document.getElementById('input-buscar-detalle').value = '';
        document.getElementById('lista-resultados').innerHTML = '<li><em>Escribe algo en el buscador...</em></li>';
    });
    
    // Buscador en detalle
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
                    mostrarDetalle(term, false);
                });
                lista.appendChild(li);
            });
            
            var inputDetalle = document.getElementById('input-buscar-detalle');
            inputDetalle.parentNode.style.position = 'relative';
            inputDetalle.parentNode.appendChild(lista);
        });
    });
    
    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (e.target.id !== 'input-buscar-detalle') {
            var lista = document.getElementById('sugerencias-detalle');
            if (lista) lista.remove();
        }
    });
}

// =============================================
// PUBLICIDAD
// =============================================
function initAdMob() {
    var adContainer = document.createElement('div');
    adContainer.id = 'ad-container';
    adContainer.style.cssText = 
        'width:100%; height:50px; background-color:#0a3b5a; color:white; ' +
        'text-align:center; line-height:50px; font-size:14px; font-family:sans-serif; ' +
        'position:fixed; bottom:0; left:0; z-index:9999;';
    adContainer.textContent = '📢 Espacio publicitario - Anuncio próximamente';
    document.body.appendChild(adContainer);
    console.log('📢 Banner de prueba visible');
}

// =============================================
// DICCIONARIO TRILINGÜE
// =============================================

function buscarTrilingue(texto, callback) {
    const busqueda = texto.toLowerCase();
    const datos = window.datosTrilingues || datosTrilingues || [];
    
    if (datos.length === 0) {
        // Reintentar en 500ms
        setTimeout(function() {
            buscarTrilingue(texto, callback);
        }, 500);
        return;
    }
    
    var resultados = datos.filter(function(entrada) {
        for (var clave in entrada) {
            if (entrada[clave].toLowerCase().indexOf(busqueda) !== -1) {
                return true;
            }
        }
        return false;
    }).slice(0, 30);
    
    callback(resultados);
}

function mostrarResultadosTrilingue(resultados) {
    var contenedor = document.getElementById('resultado-triligue');
    
    if (resultados.length === 0) {
        contenedor.innerHTML = '<p style="color:#888; text-align:center; margin-top:30px;">No se encontraron resultados</p>';
        return;
    }
    
    var cabeceras = Object.keys(resultados[0]);
    var html = '';
    
    resultados.forEach(function(entrada) {
        html += '<div style="background:white; border:1px solid #b0d4e3; border-radius:8px; padding:15px; margin-bottom:10px;">';
        cabeceras.forEach(function(clave) {
            html += '<div style="margin-bottom:6px;">';
            html += '<span style="font-weight:bold; color:#0a3b5a; font-size:0.8em; text-transform:uppercase;">' + clave + ':</span> ';
            html += '<span style="font-size:0.95em;">' + entrada[clave] + '</span>';
            html += '</div>';
        });
        html += '</div>';
    });
    
    contenedor.innerHTML = html;
}

function configurarTrilingue() {
        
    var inputTri = document.getElementById('input-buscar-triligue');
    document.getElementById('btn-volver-triligue')?.addEventListener('click', volverAlSplash);
    
    document.getElementById('input-buscar-triligue')?.addEventListener('input', function() {
		var texto = this.value.trim();
		if (texto.length < 2) {
			document.getElementById('resultado-triligue').innerHTML = '<p style="color:#888; text-align:center; margin-top:30px;">Escribe al menos 2 letras para buscar</p>';
			return;
		}
		document.getElementById('resultado-triligue').innerHTML = '<p style="color:#888; text-align:center; margin-top:30px;">Buscando...</p>';
		buscarTrilingue(texto, function(resultados) {
			mostrarResultadosTrilingue(resultados);
		});
	});
}



// =============================================
// TÍTULOS DE ENCABEZADO → VOLVER AL SPLASH
// =============================================
function configurarTitulosCliqueables() {
    setTimeout(function() {
        var tituloApp = document.getElementById('titulo-header');
        var tituloEnlaces = document.getElementById('titulo-header-enlaces');
        
        if (tituloApp) {
            tituloApp.style.cursor = 'pointer';
            tituloApp.addEventListener('click', function() {
                document.getElementById('app').style.display = 'none';
                document.getElementById('enlaces-externos').style.display = 'none';
                document.getElementById('splash').style.display = 'flex';
            });
        }
        
        if (tituloEnlaces) {
            tituloEnlaces.style.cursor = 'pointer';
            tituloEnlaces.addEventListener('click', function() {
                document.getElementById('enlaces-externos').style.display = 'none';
                document.getElementById('app').style.display = 'none';
                document.getElementById('splash').style.display = 'flex';
            });
        }
        
        console.log('✅ Títulos cliqueables configurados');
    }, 500);
}

// Hacer que todos los títulos "Diccionario Náutico" lleven al splash
document.querySelectorAll('span[id*="titulo-header"], h1[id*="titulo-header"]').forEach(function(el) {
    el.style.cursor = 'pointer';
    el.addEventListener('click', function() {
        document.getElementById('splash').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        document.getElementById('enlaces-externos').style.display = 'none';
        document.getElementById('trilingue').style.display = 'none';
    });
});
