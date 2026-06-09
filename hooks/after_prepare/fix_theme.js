const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const themesPath = path.join(context.opts.projectRoot, 'platforms/android/app/src/main/res/values/themes.xml');
    
    if (fs.existsSync(themesPath)) {
        const newContent = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen.IconBackground">
        <item name="windowSplashScreenBackground">@color/cdv_splashscreen_background</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/ic_cdv_splashscreen</item>
        <item name="windowSplashScreenAnimationDuration">200</item>
        <item name="postSplashScreenTheme">@style/Theme.App.Main</item>
    </style>
    
    <style name="Theme.App.Main" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>
        <item name="android:statusBarColor">#FFFFFF</item>
        <item name="android:navigationBarColor">#FFFFFF</item>
    </style>
</resources>`;
        
        fs.writeFileSync(themesPath, newContent, 'utf8');
        console.log('✅ themes.xml modificado correctamente con iconos oscuros');
    }
};