package com.tuapp.admob;

import android.app.Activity;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.LinearLayout;

import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaArgs;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONException;
import org.json.JSONObject;

public class AdMobPlugin extends CordovaPlugin {

    private AdView bannerAd;
    private static final String ACTION_CREATE_BANNER = "createBanner";

    @Override
    public boolean execute(String action, CordovaArgs args, CallbackContext callbackContext) throws JSONException {
        if (ACTION_CREATE_BANNER.equals(action)) {
            JSONObject options = args.getJSONObject(0);
            String adId = options.optString("adId", "ca-app-pub-3940256099942544/6300978111");
            createBanner(adId, callbackContext);
            return true;
        }
        return false;
    }

    private void createBanner(final String adId, final CallbackContext callbackContext) {
        final Activity activity = cordova.getActivity();

        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    bannerAd = new AdView(activity);
                    bannerAd.setAdSize(AdSize.BANNER);
                    bannerAd.setAdUnitId(adId);

                    AdRequest adRequest = new AdRequest.Builder().build();
                    bannerAd.loadAd(adRequest);

                    LinearLayout layout = new LinearLayout(activity);
                    layout.setGravity(Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
                    layout.addView(bannerAd);

                    activity.addContentView(layout, new ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT));

                    callbackContext.success("Banner creado");
                } catch (Exception e) {
                    callbackContext.error(e.getMessage());
                }
            }
        });
    }

    @Override
    public void onDestroy() {
        if (bannerAd != null) {
            bannerAd.destroy();
        }
        super.onDestroy();
    }
}