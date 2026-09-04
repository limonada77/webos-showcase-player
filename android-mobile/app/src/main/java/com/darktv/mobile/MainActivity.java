package com.darktv.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.provider.Settings;
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
 * DarkTV Mobile
 *
 * Reutiliza exatamente o mesmo front-end de public/tv usado pela
 * versão webOS/Android TV. O workflow copia esses arquivos para
 * assets/www em cada build.
 *
 * A ponte continua chamada AndroidTV para manter compatibilidade
 * total com o app.js existente, inclusive o ID usado na liberação.
 */
public class MainActivity extends Activity {

    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUi();

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
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new Bridge(), "AndroidTV");

        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
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
        try {
            List<NetworkInterface> list =
                Collections.list(NetworkInterface.getNetworkInterfaces());

            for (NetworkInterface nif : list) {
                String name = nif.getName();

                if (!"wlan0".equalsIgnoreCase(name) &&
                    !"eth0".equalsIgnoreCase(name)) {
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

            if (androidId == null) {
                androidId = "darktv-mobile";
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

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                "document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:461,which:461,bubbles:true}))",
                null
            );
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
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
