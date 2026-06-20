document.addEventListener('deviceready', function() {
    const AdMob = Capacitor.Plugins.AdMob;

    if (!AdMob) {
        console.error('Plugin AdMob no encontrado');
        return;
    }

    AdMob.initialize({
        requestTrackingAuthorization: true,
        initializeForTesting: false
    }).catch(function(error) {
        console.error('Error inicializando AdMob:', error);
    });

    window.mostrarBanner = async function() {
        try {
            await AdMob.showBanner({
                adId: 'ca-app-pub-3447093666998031/2796606187',
                adSize: 'ADAPTIVE_BANNER',
                position: 'BOTTOM_CENTER',
                margin: 0,
                isTesting: false
            });
            console.log('Banner mostrado');
        } catch (e) {
            console.error('Error al mostrar banner:', e);
        }
    };

    window.ocultarBanner = async function() {
        try {
            await AdMob.removeBanner();
            console.log('Banner eliminado');
        } catch (e) {
            console.error('Error al eliminar banner:', e);
        }
    };

    window.ocultarBanner();
});