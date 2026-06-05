document.addEventListener('deviceready', async function() {
    console.log('🔍 [ADMOB.JS] Iniciando módulo de publicidad...');
    
    if (typeof admob === 'undefined') {
        console.warn('⚠️ [ADMOB.JS] Plugin no detectado. Se omite carga.');
        return;
    }

    try {
        // 1. Inicializar SDK
        await admob.start();
        console.log('✅ [ADMOB.JS] SDK inicializado.');

        // 2. Crear banner adaptable
        window.bannerAd = new admob.BannerAd({
            adUnitId: 'ca-app-pub-3447093666998031/2796606187',
            position: 'bottom',
            size: 'SMART_BANNER', // Solicita tamaño adaptable
            margin: 0
        });

        // 3. Retrasar la acción inicial para que el WebView mida bien el ancho
        setTimeout(async () => {
            await window.bannerAd.hide();
            console.log('✅ [ADMOB.JS] Banner creado, medido y OCULTO. Esperando navegación...');
        }, 500); // 500ms es suficiente para que el CSS se estabilice

        // 4. Configurar listeners para control manual
        document.addEventListener('show-banner', async () => {
            if (window.bannerAd) {
                await window.bannerAd.show();
                console.log('✅ [ADMOB.JS] Banner visible.');
            }
        });

        document.addEventListener('hide-banner', async () => {
            if (window.bannerAd) {
                await window.bannerAd.hide();
                console.log('✅ [ADMOB.JS] Banner oculto.');
            }
        });

    } catch (error) {
        console.error('❌ [ADMOB.JS] Error crítico:', error);
    }
}, false);