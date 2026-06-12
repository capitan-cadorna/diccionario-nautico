document.addEventListener('deviceready', async function() {
    console.log('🔍 [ADMOB.JS] Iniciando módulo de publicidad...');
    
    if (typeof admob === 'undefined') {
        console.warn('⚠️ [ADMOB.JS] Plugin no detectado. Se omite carga.');
        return;
    }

    try {
        await admob.start();
        console.log('✅ [ADMOB.JS] SDK inicializado.');

        const isTablet = window.innerWidth >= 768;

        window.bannerAd = new admob.BannerAd({
            adUnitId: 'ca-app-pub-3447093666998031/2796606187',
            position: 'bottom',
            size: isTablet ? 'LEADERBOARD' : 'ADAPTIVE_BANNER',
            offset: 0  // Sin separación adicional
        });

        setTimeout(async () => {
            await window.bannerAd.hide();
            console.log('✅ [ADMOB.JS] Banner creado y oculto.');
        }, 500);

        function calcularPaddingBottom() {
            const safeBottom = parseInt(
                getComputedStyle(document.documentElement)
                    .getPropertyValue('env(safe-area-inset-bottom)')
            ) || 0;
            return (50 + safeBottom) + 'px';
        }

        document.addEventListener('show-banner', async () => {
            if (window.bannerAd) {
                await window.bannerAd.show();
                document.body.style.paddingBottom = calcularPaddingBottom();
                console.log('📢 Banner mostrado. Padding: ' + calcularPaddingBottom());
            }
        });

        document.addEventListener('hide-banner', async () => {
            if (window.bannerAd) {
                await window.bannerAd.hide();
                document.body.style.paddingBottom = '0px';
                console.log('🙈 Banner oculto.');
            }
        });

    } catch (error) {
        console.error('❌ [ADMOB.JS] Error crítico:', error);
    }
}, false);