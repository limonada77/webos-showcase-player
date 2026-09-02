package com.ericktv.app;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

public class MainActivity extends AppCompatActivity {

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        final WebViewAssetLoader loader =
            new WebViewAssetLoader.Builder()
                .addPathHandler(
                    "/assets/",
                    new WebViewAssetLoader.AssetsPathHandler(this)
                )
                .build();

        webView.setWebViewClient(
            new WebViewClientCompat() {

                @Override
                public WebResourceResponse shouldInterceptRequest(
                    WebView view,
                    WebResourceRequest request
                ) {
                    return loader.shouldInterceptRequest(
                        request.getUrl()
                    );
                }

                @Override
                @SuppressWarnings("deprecation")
                public WebResourceResponse shouldInterceptRequest(
                    WebView view,
                    String url
                ) {
                    return loader.shouldInterceptRequest(
                        android.net.Uri.parse(url)
                    );
                }
            }
        );

        webView.loadUrl(
            "https://appassets.androidplatform.net/" +
            "assets/www/index.html"
        );
    }

    /*
     * Traduz BACK do controle Android TV para
     * o mesmo evento usado pelo app web.
     */
    @Override
    public void onBackPressed() {
        webView.evaluateJavascript(
            "document.dispatchEvent(" +
            "new KeyboardEvent('keydown'," +
            "{keyCode:461,which:461}))",
            null
        );
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {

        if (event.getAction() == KeyEvent.ACTION_DOWN) {

            int code = event.getKeyCode();

            if (code == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE) {
                sendKey(13);
                return true;
            }

            if (code == KeyEvent.KEYCODE_MEDIA_FAST_FORWARD) {
                sendKey(39);
                return true;
            }

            if (code == KeyEvent.KEYCODE_MEDIA_REWIND) {
                sendKey(37);
                return true;
            }
        }

        return super.dispatchKeyEvent(event);
    }

    private void sendKey(int keyCode) {
        webView.evaluateJavascript(
            "document.dispatchEvent(" +
            "new KeyboardEvent('keydown'," +
            "{keyCode:" + keyCode +
            ",which:" + keyCode + "}))",
            null
        );
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }

        super.onDestroy();
    }
}
