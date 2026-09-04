package com.darktv.app;

import android.annotation.SuppressLint;
import android.app.Activity;
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
 * DarkTV — casca Android TV que carrega exatamente o mesmo
 * app web usado no .ipk da LG (assets/www).
 *
 * Usa Activity pura (sem AppCompat) para não depender de tema
 * AppCompat, e carrega via file:// para o app ter o mesmo
 * comportamento de origem que tem no webOS (sem bloqueio CORS /
 * conteúdo misto ao falar com servidores Xtream em http).
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
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // Mesma origem "local" do webOS: permite chamar servidores Xtream
        // http/https sem CORS bloquear.
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new Bridge(), "AndroidTV");

        webView.loadUrl("file:///android_asset/www/index.html");
        webView.requestFocus();
    }

    /* Ponte JS -> Android (window.AndroidTV.exit()). */
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
                androidId = "darktv-android-tv";
            }

            MessageDigest digest =
                MessageDigest.getInstance("SHA-256");

            byte[] bytes =
                digest.digest(androidId.getBytes("UTF-8"));

            bytes[0] =
                (byte) ((bytes[0] | 0x02) & 0xFE);

            return formatDeviceBytes(bytes);

        } catch (Exception ignored) {
            return "02:00:00:00:00:01";
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
        webView.evaluateJavascript(
            "document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:" + keyCode +
            ",which:" + keyCode + ",bubbles:true}))",
            null
        );
    }

    /*
     * BACK do controle vira o keyCode 461 (BACK do webOS) dentro do app web.
     * Assim o mesmo goBack() do .ipk funciona no Android TV.
     */
    @Override
    public void onBackPressed() {
        sendKey(461);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            switch (event.getKeyCode()) {
                case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                case KeyEvent.KEYCODE_MEDIA_PLAY:
                case KeyEvent.KEYCODE_MEDIA_PAUSE:
                    sendKey(13);
                    return true;
                case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                    sendKey(39);
                    return true;
                case KeyEvent.KEYCODE_MEDIA_REWIND:
                    sendKey(37);
                    return true;
                case KeyEvent.KEYCODE_MEDIA_STOP:
                    sendKey(413);
                    return true;
                default:
                    break;
            }
        }
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
