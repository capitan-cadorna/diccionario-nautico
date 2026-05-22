// =============================================
// CONFIGURACIÓN
// =============================================
const CONFIG = {
    dbName: 'diccionario.db',
    versionKey: 'db_version',
    versionActual: '4.36'
};

// =============================================
// VARIABLES GLOBALES
// =============================================
let db = null;
let historial = [];

// =============================================
// INICIALIZACIÓN
// =============================================
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
	
    console.log('✅ Dispositivo listo');
    
    db = window.sqlitePlugin.openDatabase({
        name: CONFIG.dbName,
        location: 'default'
    });
    
    crearTabla();
    initAdMob();
    configurarUI();
    verificarYActualizar();
    
    // Mostrar fecha en splash
    var fecha = localStorage.getItem('diccionario_fecha') || '';
    var fechaElem = document.getElementById('fecha-actualizacion-splash');
    if (fechaElem && fecha) {
        fechaElem.textContent = '📅 Actualizado: ' + fecha;
    }
	function actualizarContadorSplash() {
		setTimeout(function() {
			db.executeSql(
				'SELECT COUNT(*) as total FROM terminos',
				[],
				function(rs) {
					var total = rs.rows.item(0).total;
					console.log('📊 Total términos en BD: ' + total);
					
					var splashSubtitulo = document.querySelector('.splash-subtitulo');
					if (splashSubtitulo) {
						splashSubtitulo.textContent = total + ' términos náuticos en tu bolsillo';
						console.log('✅ Texto del splash actualizado');
					} else {
						console.warn('⚠️ No se encontró .splash-subtitulo');
					}
				},
				function(error) {
					console.error('Error al contar términos:', error);
				}
			);
		}, 500); // Pequeño retraso para asegurar que la BD está lista
	}
	// Actualizar contador si ya hay datos cargados
    setTimeout(function() {
        actualizarContadorSplash();
    }, 1000);
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
        function(error) { console.error('❌ Búsqueda:', error); callback([]); }
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
        function(error) { console.error('Error:', error); callback(null); }
    );
}

// =============================================
// CARGA DEL JSON LOCAL
// =============================================
function verificarYActualizar() {
    var versionLocal = localStorage.getItem(CONFIG.versionKey) || '0';
    var fechaLocal = localStorage.getItem('diccionario_fecha') || '';
    
    // Mostrar fecha en el splash
    var splashFecha = document.getElementById('fecha-actualizacion-splash');
    if (splashFecha) {
        if (!fechaLocal || fechaLocal === '0') {
            splashFecha.textContent = '📅 Diccionario precargado';
        } else {
            splashFecha.textContent = '📅 Actualizado: ' + fechaLocal;
        }
    }
    
    // Mostrar fecha en el header de la app
    var fechaElem = document.getElementById('fecha-actualizacion');
    if (fechaElem) {
        if (!fechaLocal || fechaLocal === '0') {
            fechaElem.textContent = '📅 Diccionario precargado';
        } else {
            fechaElem.textContent = '📅 Actualizado: ' + fechaLocal;
        }
    }
    
    // Cargar datos si es primera vez o versión desactualizada
    if (versionLocal !== CONFIG.versionActual) {
        fetch('js/diccionario_data.json')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                insertarTerminos(data, function(total) {
                    var fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    localStorage.setItem(CONFIG.versionKey, CONFIG.versionActual);
                    localStorage.setItem('diccionario_fecha', fechaHoy);
                    
                    // Actualizar textos de fecha
                    if (splashFecha) splashFecha.textContent = '📅 Actualizado: ' + fechaHoy;
                    if (fechaElem) fechaElem.textContent = '📅 Actualizado: ' + fechaHoy;
					actualizarContadorSplash();
                });
            })
            .catch(function(error) {
                console.error('❌ Error al cargar JSON:', error);
            });
    }
}

// =============================================
// INTERFAZ
// =============================================
function formatearDefinicion(texto) {
    // Enlaces web externos
    texto = texto.replace(/\[\[WEB:([^|]+)\|([^\]]+)\]\]/g, function(match, url, term) {
        return '<span class="enlace-web" data-url="' + url + '">' + term + '</span>';
    });
    // Enlaces internos
    texto = texto.replace(/\[\[([^\]]+)\]\]/g, function(match, term) {
        return '<span class="enlace-term" data-term="' + term + '">' + term + '</span>';
    });
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
                if (termEncontrado) {
                    mostrarDetalle(termEncontrado);
                } else {
                    alert('Término no encontrado: ' + terminoBuscado);
                }
            });
        });
    }
    
    var enlacesWeb = document.querySelectorAll('#detalle-definicion .enlace-web');
    for (var j = 0; j < enlacesWeb.length; j++) {
        enlacesWeb[j].addEventListener('click', function() {
            var url = this.getAttribute('data-url');
            if (typeof cordova !== 'undefined' && cordova.InAppBrowser) {
                cordova.InAppBrowser.open(url, '_system');
            } else {
                window.open(url, '_blank');
            }
        });
    }
}

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
                        }
                    });
                });
                lista.appendChild(li);
            });
        });
    });
    
    // Botón Volver
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
    
    // Botón Home
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
    const busqueda = texto.toLowerCase();
    return datosTrilingues.filter(function(entrada) {
        for (var clave in entrada) {
            if (entrada[clave].toLowerCase().indexOf(busqueda) !== -1) return true;
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
    document.getElementById('enlaces-externos').style.display = 'none';
    document.getElementById('trilingue').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('busqueda').style.display = 'block';
    document.getElementById('resultados').style.display = 'block';
    document.getElementById('detalle').style.display = 'none';
	document.querySelector('#app > header').style.display = 'block';
});

document.getElementById('btn-triligue-splash').addEventListener('click', function() {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('busqueda').style.display = 'none';
    document.getElementById('resultados').style.display = 'none';
    document.getElementById('detalle').style.display = 'none';
    document.getElementById('trilingue').style.display = 'block';
	document.querySelector('#app > header').style.display = 'none';
});

document.getElementById('btn-enlaces').addEventListener('click', function() {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('trilingue').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'block';
});

// Enlaces externos: abrir en navegador
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

// =============================================
// PUBLICIDAD
// =============================================
function initAdMob() {
    var adContainer = document.createElement('div');
    adContainer.id = 'ad-container';
    adContainer.style.cssText = 'width:100%; height:50px; background-color:#0a3b5a; color:white; text-align:center; line-height:50px; font-size:14px; font-family:sans-serif; position:fixed; bottom:0; left:0; z-index:9999;';
    adContainer.textContent = '📢 Espacio publicitario';
    document.body.appendChild(adContainer);
}

// Cargar trilingüe al iniciar
cargarDiccionarioTrilingue();

// =============================================
// MENÚ HAMBURGUESA (compatible con IDs duplicados)
// =============================================

// Abrir/cerrar menú al pulsar ☰ en cualquier sección
document.addEventListener('click', function(e) {
    if (e.target.closest('#btn-menu')) {
        e.stopPropagation();
        var menu = e.target.closest('header').querySelector('#menu-desplegable');
        if (menu) {
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        }
        return;
    }
    // Cerrar todos los menús al hacer clic fuera
    document.querySelectorAll('#menu-desplegable').forEach(function(m) {
        m.style.display = 'none';
    });
});

// Función para asignar eventos a elementos con IDs duplicados
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

// 🏠 Inicio
asignarMenu('menu-inicio', function() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'none';
    document.getElementById('trilingue').style.display = 'none';
    document.getElementById('splash').style.display = 'flex';
    document.querySelector('#app > header').style.display = 'block';
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
});

// 🔗 Enlaces Externos
asignarMenu('menu-enlaces', function() {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('trilingue').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'block';
});

// 📤 Compartir app
asignarMenu('menu-compartir', function() {
    var mensaje = 'Descubre el Diccionario Náutico. Más de 2.000 términos sin conexión. ¡Descárgala gratis! ⚓';
    var enlace = 'https://play.google.com/store/apps/details?id=ar.com.diccionario_nautico';
    if (typeof window.plugins !== 'undefined' && window.plugins.socialsharing !== 'undefined') {
        window.plugins.socialsharing.share(mensaje, 'Diccionario Náutico', null, enlace);
    } else {
        alert('📤 ' + mensaje + '\n\n' + enlace);
    }
});

// ℹ️ Acerca de
asignarMenu('menu-acerca', function() {
    alert('⚓ Diccionario Náutico\n\nVersión: ' + CONFIG.versionActual + 
          '\n\nDesarrollado por Capitan Cadorna\ndiccionario-nautico.com.ar\n\n© ' + new Date().getFullYear());
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
    });
});

