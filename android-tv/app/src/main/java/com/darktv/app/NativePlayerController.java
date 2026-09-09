package com.darktv.app;

import android.app.Activity;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

/**
 * Player nativo exclusivo do APK Android TV.
 *
 * O servidor do usuário entrega em rajadas (30 Mbps e depois vários
 * segundos quase zerado). O WebView voltava a tocar cedo demais.
 *
 * Esta configuração acumula uma reserva real:
 * - mínimo 30s
 * - máximo 120s
 * - início 8s
 * - após rebuffer 15s
 * - back buffer 30s
 */
@UnstableApi
public final class NativePlayerController {

    private static final int MIN_BUFFER_MS = 30_000;
    private static final int MAX_BUFFER_MS = 120_000;
    private static final int PLAYBACK_BUFFER_MS = 8_000;
    private static final int REBUFFER_MS = 15_000;
    private static final int BACK_BUFFER_MS = 30_000;

    private final Activity activity;
    private final PlayerView playerView;
    private final WebView webView;
    private final Handler handler =
        new Handler(Looper.getMainLooper());

    private ExoPlayer player;
    private boolean active = false;
    private String kind = "";

    private final Runnable progressUpdater =
        new Runnable() {
            @Override
            public void run() {
                if (!active || player == null) {
                    return;
                }

                updateWebProgress();

                handler.postDelayed(
                    this,
                    500
                );
            }
        };

    public NativePlayerController(
        Activity activity,
        PlayerView playerView,
        WebView webView
    ) {
        this.activity = activity;
        this.playerView = playerView;
        this.webView = webView;

        createPlayer();
    }

    private void createPlayer() {
        DefaultLoadControl loadControl =
            new DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                    MIN_BUFFER_MS,
                    MAX_BUFFER_MS,
                    PLAYBACK_BUFFER_MS,
                    REBUFFER_MS
                )
                .setBackBuffer(
                    BACK_BUFFER_MS,
                    true
                )
                .build();

        player =
            new ExoPlayer.Builder(activity)
                .setLoadControl(loadControl)
                .setSeekBackIncrementMs(10_000)
                .setSeekForwardIncrementMs(10_000)
                .build();

        playerView.setUseController(false);
        playerView.setPlayer(player);

        player.addListener(
            new Player.Listener() {
                @Override
                public void onPlaybackStateChanged(
                    int playbackState
                ) {
                    if (!active) return;

                    if (
                        playbackState ==
                        Player.STATE_BUFFERING
                    ) {
                        setSpinner(true);
                    } else if (
                        playbackState ==
                        Player.STATE_READY
                    ) {
                        setSpinner(false);
                    } else if (
                        playbackState ==
                        Player.STATE_ENDED
                    ) {
                        setSpinner(false);

                        /*
                         * Para série, reaproveita o botão do OSD.
                         * Ele já sabe qual é o próximo episódio e
                         * mantém todo o histórico do DarkTV.
                         */
                        if ("series".equals(kind)) {
                            runJs(
                                "(function(){" +
                                "var b=document.getElementById('osd-next-ep');" +
                                "if(b&&!b.classList.contains('hidden'))b.click();" +
                                "})();"
                            );
                        }
                    }
                }

                @Override
                public void onPlayerError(
                    @NonNull PlaybackException error
                ) {
                    setSpinner(false);

                    String message =
                        error.getMessage();

                    if (message == null) {
                        message =
                            "Falha ao reproduzir o stream";
                    }

                    message =
                        message
                            .replace("\\", "\\\\")
                            .replace("'", "\\'");

                    runJs(
                        "(function(){" +
                        "var e=document.getElementById('player-error');" +
                        "if(e){e.textContent='" +
                        message +
                        " · Pressione VOLTAR para retornar.';" +
                        "e.classList.add('show');}" +
                        "})();"
                    );
                }
            }
        );
    }

    public void play(
        String url,
        String title,
        double resumeSeconds,
        String kind
    ) {
        if (
            url == null ||
            url.trim().isEmpty()
        ) {
            return;
        }

        this.kind =
            kind == null
                ? ""
                : kind;

        active = true;

        playerView.setVisibility(
            View.VISIBLE
        );

        runJs(
            "document.documentElement.classList.add('native-player-active');"
        );

        MediaItem item =
            MediaItem.fromUri(
                Uri.parse(url)
            );

        long startMs =
            Math.max(
                0L,
                (long) (
                    resumeSeconds *
                    1000.0
                )
            );

        player.stop();
        player.clearMediaItems();
        player.setMediaItem(
            item,
            startMs
        );
        player.prepare();
        player.play();

        handler.removeCallbacks(
            progressUpdater
        );

        handler.post(
            progressUpdater
        );

        setSpinner(true);
    }

    public void stop() {
        if (!active) return;

        active = false;

        handler.removeCallbacks(
            progressUpdater
        );

        if (player != null) {
            player.pause();
            player.stop();
            player.clearMediaItems();
        }

        playerView.setVisibility(
            View.GONE
        );

        runJs(
            "document.documentElement.classList.remove('native-player-active');"
        );
    }

    public void toggle() {
        if (
            !active ||
            player == null
        ) {
            return;
        }

        if (player.isPlaying()) {
            player.pause();
        } else {
            player.play();
        }
    }

    public void seekBy(
        double seconds
    ) {
        if (
            !active ||
            player == null
        ) {
            return;
        }

        long target =
            player.getCurrentPosition() +
            (long) (
                seconds *
                1000.0
            );

        seekToMs(target);
    }

    public void seekTo(
        double seconds
    ) {
        if (
            !active ||
            player == null
        ) {
            return;
        }

        seekToMs(
            (long) (
                seconds *
                1000.0
            )
        );
    }

    private void seekToMs(
        long target
    ) {
        long duration =
            player.getDuration();

        target =
            Math.max(
                0L,
                target
            );

        if (duration > 0) {
            target =
                Math.min(
                    target,
                    Math.max(
                        0L,
                        duration - 100L
                    )
                );
        }

        player.seekTo(target);
    }

    public double getPositionSeconds() {
        if (
            !active ||
            player == null
        ) {
            return 0.0;
        }

        return (
            player.getCurrentPosition() /
            1000.0
        );
    }

    public double getDurationSeconds() {
        if (
            !active ||
            player == null
        ) {
            return 0.0;
        }

        long duration =
            player.getDuration();

        return duration > 0
            ? duration / 1000.0
            : 0.0;
    }

    public boolean isActive() {
        return active;
    }

    public void setAspect(
        int mode
    ) {
        if (!active) return;

        int resizeMode;

        switch (mode) {
            case 1:
                resizeMode =
                    AspectRatioFrameLayout
                        .RESIZE_MODE_ZOOM;
                break;

            case 2:
                resizeMode =
                    AspectRatioFrameLayout
                        .RESIZE_MODE_FILL;
                break;

            case 3:
                resizeMode =
                    AspectRatioFrameLayout
                        .RESIZE_MODE_ZOOM;
                break;

            case 0:
            default:
                resizeMode =
                    AspectRatioFrameLayout
                        .RESIZE_MODE_FIT;
                break;
        }

        playerView.setResizeMode(
            resizeMode
        );
    }

    private void setSpinner(
        boolean show
    ) {
        runJs(
            "(function(){" +
            "var s=document.getElementById('player-spinner');" +
            "if(s)s.classList." +
            (show ? "add" : "remove") +
            "('show');" +
            "})();"
        );
    }

    private void updateWebProgress() {
        if (
            player == null ||
            !active
        ) {
            return;
        }

        final double pos =
            Math.max(
                0.0,
                player.getCurrentPosition() /
                1000.0
            );

        long durationMs =
            player.getDuration();

        final double dur =
            durationMs > 0
                ? durationMs / 1000.0
                : 0.0;

        final double pct =
            dur > 0.0
                ? Math.max(
                    0.0,
                    Math.min(
                        100.0,
                        pos / dur * 100.0
                    )
                )
                : 100.0;

        runJs(
            "(function(){" +
            "function f(s){" +
            "if(!isFinite(s)||s<0)return'--:--';" +
            "s=Math.floor(s);" +
            "var h=Math.floor(s/3600)," +
            "m=Math.floor((s%3600)/60)," +
            "x=s%60;" +
            "function p(n){return n<10?'0'+n:''+n;}" +
            "return(h>0?h+':':'')+p(m)+':'+p(x);" +
            "}" +
            "var c=document.getElementById('osd-cur');" +
            "var d=document.getElementById('osd-dur');" +
            "var b=document.getElementById('osd-progress');" +
            "if(c)c.textContent=f(" +
            pos +
            ");" +
            "if(d)d.textContent=" +
            (dur > 0
                ? "f(" + dur + ")"
                : "'AO VIVO'") +
            ";" +
            "if(b)b.style.width='" +
            pct +
            "%';" +
            "})();"
        );
    }

    private void runJs(
        String js
    ) {
        if (webView == null) return;

        webView.post(
            () ->
                webView.evaluateJavascript(
                    js,
                    null
                )
        );
    }

    public void release() {
        active = false;

        handler.removeCallbacksAndMessages(
            null
        );

        if (player != null) {
            player.release();
            player = null;
        }

        playerView.setPlayer(null);
    }
}
