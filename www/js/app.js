// =============================================
// CONFIGURACIÓN
// =============================================
const CONFIG = {
    dbName: 'diccionario.db',
    versionKey: 'db_version',
    versionActual: '3.92' // Cambia esto manualmente al actualizar el JSON
};

// =============================================
// VARIABLES GLOBALES
// =============================================
let db = null;
let historial = [];  // Historial de términos visitados

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
    initAdMob();        // ← Añadido
    configurarUI();
    verificarYActualizar();
	cargarDiccionarioTrilingue();
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
    // Primero buscar exacto
    db.executeSql(
        'SELECT * FROM terminos WHERE LOWER(titulo) = ? LIMIT 1',
        [texto.toLowerCase()],
        function(rs) {
            if (rs.rows.length > 0) {
                callback(rs.rows.item(0));
                return;
            }
            
            // Si no encuentra, intentar sin la última letra (para plurales: rumbos -> rumbo)
            var textoSinUltima = texto.slice(0, -1);
            db.executeSql(
                'SELECT * FROM terminos WHERE LOWER(titulo) = ? LIMIT 1',
                [textoSinUltima.toLowerCase()],
                function(rs2) {
                    if (rs2.rows.length > 0) {
                        callback(rs2.rows.item(0));
                    } else {
                        // Último recurso: buscar con LIKE
                        buscarTerminos(texto, function(resultados) {
                            if (resultados.length > 0) {
                                callback(resultados[0]);
                            } else {
                                callback(null);
                            }
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
// CARGA DEL JSON LOCAL
// =============================================
function verificarYActualizar() {
    // Forzar eliminación de la BD anterior
    db.executeSql('DELETE FROM terminos', [], function() {
        console.log('🗑️ Base de datos limpiada');
    }, function(err) {
        console.error('Error al limpiar:', err);
    });
    
    // Eliminar versión guardada
    localStorage.removeItem(CONFIG.versionKey);
    
    // Ahora cargar el JSON nuevo
    fetch('js/diccionario_data.json')
        .then(response => response.json())
        .then(data => {
            console.log('📦 ' + data.length + ' términos leídos del JSON');
            insertarTerminos(data, function(total) {
                alert('Diccionario recargado: ' + total + ' términos');
                localStorage.setItem(CONFIG.versionKey, '3.92');
            });
        })
        .catch(error => {
            console.error('❌ Error:', error);
            alert('Error al cargar');
        });
}

// =============================================
// INTERFAZ
// =============================================

/**
 * Convierte marcadores [[término]] en spans interactivos para buscar.
 * @param {string} texto - El texto con marcadores.
 * @returns {string} - HTML con spans clicables.
 */
function formatearDefinicion(texto) {
    // Convertir marcadores WEB:url|texto en enlaces externos
    texto = texto.replace(/\[\[WEB:([^|]+)\|([^\]]+)\]\]/g, function(match, url, term) {
        return '<span class="enlace-web" data-url="' + url + '">' + term + '</span>';
    });
    
    // Convertir marcadores [[término]] en spans interactivos
    texto = texto.replace(/\[\[([^\]]+)\]\]/g, function(match, term) {
        return '<span class="enlace-term" data-term="' + term + '">' + term + '</span>';
    });
    
    return texto;
}

function mostrarDetalle(term, guardarEnHistorial) {
    // Por defecto, guardar en historial
    if (guardarEnHistorial !== false) {
        // Guardar el término actual en el historial si hay uno mostrado
        var tituloActual = document.getElementById('detalle-titulo').textContent;
        if (tituloActual && tituloActual !== term.titulo && tituloActual !== 'Término') {
            // Guardar el término actual con su título y definición directamente
            historial.push({
				titulo: tituloActual,
				definicion: document.getElementById('detalle-definicion').innerHTML
			});
        }
    }
    
    // Mostrar el nuevo término
    document.getElementById('busqueda').style.display = 'none';
    document.getElementById('resultados').style.display = 'none';
    document.getElementById('detalle').style.display = 'block';
    document.getElementById('detalle-titulo').textContent = term.titulo;
    document.getElementById('detalle-definicion').innerHTML = formatearDefinicion(term.definicion);
    
    // Asignar eventos a los enlaces
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
	
	// Asignar eventos a los enlaces web externos
	var enlacesWeb = document.querySelectorAll('#detalle-definicion .enlace-web');
	for (var j = 0; j < enlacesWeb.length; j++) {
		enlacesWeb[j].addEventListener('click', function() {
			var url = this.getAttribute('data-url');
			cordova.InAppBrowser.open(url, '_system');
		});
	}
	
	// Asignar eventos a los enlaces web (categorías excluidas)
	var enlacesWeb = document.querySelectorAll('#detalle-definicion .enlace-web');
	for (var j = 0; j < enlacesWeb.length; j++) {
		enlacesWeb[j].addEventListener('click', function() {
			var url = this.getAttribute('data-url');
			// Abrir en el navegador del móvil
			cordova.InAppBrowser.open(url, '_system');
		});
	}
}

function configurarUI() {
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
							mostrarDetalle(termEncontrado, false);  // ← Añadir false aquí
						} else {
							alert('Término no encontrado: ' + term.titulo);
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
			
			// Reasignar eventos a los enlaces
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
		} else {
			// Si no hay historial, volver al buscador
			document.getElementById('detalle').style.display = 'none';
			document.getElementById('busqueda').style.display = 'block';
			document.getElementById('resultados').style.display = 'block';
		}
	});

	// Buscador en la vista de detalle
	document.getElementById('input-buscar-detalle').addEventListener('input', function() {
		const texto = this.value.trim();
		
		// Eliminar lista anterior si existe
		var listaAnterior = document.getElementById('sugerencias-detalle');
		if (listaAnterior) listaAnterior.remove();
		
		if (texto.length < 2) return;
		
		buscarTerminos(texto, function(resultados) {
			if (resultados.length === 0) return;
			
			// Crear lista de sugerencias debajo del input
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
			
			// Insertar lista después del input
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

	// Botón Home (ir al inicio)
	document.getElementById('btn-home').addEventListener('click', function() {
		historial = [];
		document.getElementById('detalle').style.display = 'none';
		document.getElementById('busqueda').style.display = 'block';
		document.getElementById('resultados').style.display = 'block';
		document.getElementById('input-buscar').value = '';
		document.getElementById('input-buscar-detalle').value = '';
		document.getElementById('lista-resultados').innerHTML = '<li><em>Escribe algo en el buscador...</em></li>';
	});
}

// =============================================
// PUBLICIDAD AdMob Pro
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
let datosTrilingues = [];

function cargarDiccionarioTrilingue() {
    fetch('js/trilingue_data.json')
        .then(response => response.json())
        .then(data => {
            datosTrilingues = data;
            console.log('🌍 ' + data.length + ' términos trilingües cargados');
        })
        .catch(error => {
            console.error('❌ Error al cargar diccionario trilingüe:', error);
        });
}

function buscarTrilingue(texto) {
    const busqueda = texto.toLowerCase();
    const resultados = datosTrilingues.filter(function(entrada) {
        // Buscar en todas las columnas
        for (var clave in entrada) {
            if (entrada[clave].toLowerCase().indexOf(busqueda) !== -1) {
                return true;
            }
        }
        return false;
    });
    
    return resultados.slice(0, 30); // Máximo 30 resultados
}

function mostrarResultadosTrilingue(resultados) {
    var contenedor = document.getElementById('resultado-triligue');
    
    if (resultados.length === 0) {
        contenedor.innerHTML = '<p style="color: #888; text-align: center; margin-top: 30px;">No se encontraron resultados</p>';
        return;
    }
    
    var html = '';
    var cabeceras = Object.keys(resultados[0]);
    
    resultados.forEach(function(entrada) {
        html += '<div style="background: white; border: 1px solid #b0d4e3; border-radius: 8px; padding: 15px; margin-bottom: 10px;">';
        cabeceras.forEach(function(clave) {
            html += '<div style="margin-bottom: 6px;">';
            html += '<span style="font-weight: bold; color: #0a3b5a; font-size: 0.8em; text-transform: uppercase;">' + clave + ':</span> ';
            html += '<span style="font-size: 0.95em;">' + entrada[clave] + '</span>';
            html += '</div>';
        });
        html += '</div>';
    });
    
    contenedor.innerHTML = html;
}

// Eventos del trilingüe
document.getElementById('btn-abrir-triligue')?.addEventListener('click', function() {
    document.getElementById('busqueda').style.display = 'none';
    document.getElementById('resultados').style.display = 'none';
    document.getElementById('detalle').style.display = 'none';
    document.getElementById('trilingue').style.display = 'block';
});

document.getElementById('btn-volver-triligue')?.addEventListener('click', function() {
    document.getElementById('trilingue').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'none';
    document.getElementById('splash').style.display = 'flex';
    document.getElementById('input-buscar-triligue').value = '';
    document.getElementById('resultado-triligue').innerHTML = '<p class="placeholder-triligue">Escribe al menos 2 letras para buscar</p>';
});

document.getElementById('input-buscar-triligue')?.addEventListener('input', function() {
    var texto = this.value.trim();
    if (texto.length < 2) {
        document.getElementById('resultado-triligue').innerHTML = '<p style="color: #888; text-align: center; margin-top: 30px;">Escribe al menos 2 letras para buscar</p>';
        return;
    }
    var resultados = buscarTrilingue(texto);
    mostrarResultadosTrilingue(resultados);
});

// =============================================
// NAVEGACIÓN DESDE EL SPLASH
// =============================================

// Botón Diccionario Náutico → abre la app principal
document.getElementById('btn-diccionario').addEventListener('click', function() {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'none';
    document.getElementById('trilingue').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('busqueda').style.display = 'block';
    document.getElementById('resultados').style.display = 'block';
    document.getElementById('detalle').style.display = 'none';
});

// Botón Diccionario Trilingüe → abre directamente el trilingüe
document.getElementById('btn-triligue-splash').addEventListener('click', function() {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('busqueda').style.display = 'none';
    document.getElementById('resultados').style.display = 'none';
    document.getElementById('detalle').style.display = 'none';
    document.getElementById('trilingue').style.display = 'block';
});

// Botón Enlaces Externos → abre la página de enlaces
document.getElementById('btn-enlaces').addEventListener('click', function() {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('trilingue').style.display = 'none';
    document.getElementById('enlaces-externos').style.display = 'block';
});

// Botón Volver (desde Enlaces Externos al Splash)
document.getElementById('btn-volver-splash').addEventListener('click', function() {
    document.getElementById('splash').style.display = 'flex';
    document.getElementById('enlaces-externos').style.display = 'none';
    document.getElementById('app').style.display = 'none';
});

// Enlaces externos: abrir en el navegador
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

// Botón para volver al Splash desde el header del diccionario
document.getElementById('btn-volver-splash-header').addEventListener('click', function() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('splash').style.display = 'flex';
});