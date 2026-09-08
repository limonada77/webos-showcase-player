package com.darktv.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.net.NetworkInterface;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/*
 * DarkTV Celular
 *
 * Usa exatamente o mesmo public/tv do app de TV.
 * A diferença é somente a casca Android + mobile.css/mobile.js.
 */
public class MainActivity extends Activity {

    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);

                view.evaluateJavascript(
                    "(function(){try{" +
                    "document.documentElement.classList.add('android-mobile');" +
                    "var m=document.querySelector('meta[name=viewport]');" +
                    "if(m)m.setAttribute('content','width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover');" +
                    "}catch(e){}})();",
                    null
                );
            }
        });

        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new Bridge(), "AndroidTV");

        webView.loadUrl("file:///android_asset/www/index.html");
        webView.requestFocus();
    }

    private class Bridge {
        @JavascriptInterface
        public String getDeviceId() {
            return resolveDeviceId();
        }

        @JavascriptInterface
        public void exit() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    finishAndRemoveTask();
                }
            });
        }
    }

    private String resolveDeviceId() {
        SharedPreferences prefs =
            getSharedPreferences("darktv_identity", MODE_PRIVATE);

        String saved =
            prefs.getString("stable_device_id", "");

        if (
            saved != null &&
            saved.matches("(?i)^[0-9A-F]{2}(:[0-9A-F]{2}){5}$")
        ) {
            return saved.toUpperCase(Locale.US);
        }

        String discovered = discoverInitialDeviceId();

        prefs.edit()
            .putString("stable_device_id", discovered)
            .apply();

        return discovered;
    }

    private String discoverInitialDeviceId() {
        try {
            List<NetworkInterface> list =
                Collections.list(NetworkInterface.getNetworkInterfaces());

            for (NetworkInterface nif : list) {
                String name = nif.getName();

                if (
                    !"wlan0".equalsIgnoreCase(name) &&
                    !"eth0".equalsIgnoreCase(name)
                ) {
                    continue;
                }

                byte[] mac = nif.getHardwareAddress();

                if (mac != null && mac.length >= 6) {
                    return formatDeviceBytes(mac);
                }
            }
        } catch (Exception ignored) {}

        try {
            String androidId =
                Settings.Secure.getString(
                    getContentResolver(),
                    Settings.Secure.ANDROID_ID
                );

            if (androidId == null || androidId.trim().isEmpty()) {
                androidId = "darktv-android-mobile";
            }

            MessageDigest digest =
                MessageDigest.getInstance("SHA-256");

            byte[] bytes =
                digest.digest(androidId.getBytes("UTF-8"));

            bytes[0] =
                (byte) ((bytes[0] | 0x02) & 0xFE);

            return formatDeviceBytes(bytes);

        } catch (Exception ignored) {
            return "02:00:00:00:00:02";
        }
    }

    private String formatDeviceBytes(byte[] bytes) {
        StringBuilder out = new StringBuilder();

        for (int i = 0; i < 6 && i < bytes.length; i++) {
            if (i > 0) out.append(":");

            out.append(
                String.format(
                    Locale.US,
                    "%02X",
                    bytes[i] & 0xFF
                )
            );
        }

        return out.toString();
    }

    private void sendKey(int keyCode) {
        if (webView == null) return;

        webView.evaluateJavascript(
            "document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:" +
            keyCode +
            ",which:" +
            keyCode +
            ",bubbles:true}))",
            null
        );
    }

    @Override
    public void onBackPressed() {
        sendKey(461);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        return super.dispatchKeyEvent(event);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
