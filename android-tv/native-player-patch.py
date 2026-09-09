from pathlib import Path

p = Path("android-tv/app/src/main/assets/www/app.js")
s = p.read_text(encoding="utf-8")

def once(old, new, label):
    global s
    if old not in s:
        raise SystemExit("PATCH ANDROID TV FALHOU: " + label)
    s = s.replace(old, new, 1)

# 1) A reprodução em Android TV passa para o Media3 nativo.
once(
'''    applyAspect();

    var isHls = /\\.m3u8(\\?|$)/i.test(url);''',
'''    applyAspect();

    /*
     * DARKTV_ANDROID_NATIVE_PLAYER_V1
     * Android TV usa Media3/ExoPlayer com buffer grande.
     * webOS e Celular continuam usando o player original.
     */
    if (
      window.AndroidTV &&
      typeof window.AndroidTV.nativePlayerAvailable === "function" &&
      window.AndroidTV.nativePlayerAvailable() === true &&
      typeof window.AndroidTV.nativePlay === "function"
    ) {
      try {
        document.documentElement.classList.add(
          "native-player-active"
        );

        window.AndroidTV.nativePlay(
          url,
          String(item.name || item.title || "Reproduzindo"),
          Number(state.resumeAt || 0),
          String(kind || "")
        );

        return;
      } catch (e) {
        document.documentElement.classList.remove(
          "native-player-active"
        );
      }
    }

    var isHls = /\\.m3u8(\\?|$)/i.test(url);''',
"native play"
)

# 2) Pause/play no controle remoto.
once(
'''  function togglePlay() {
    if (!video) return;
    if (video.paused) video.play().catch(function () {}); else video.pause();
    showOsd();
  }''',
'''  function togglePlay() {
    if (
      window.AndroidTV &&
      typeof window.AndroidTV.nativeIsActive === "function" &&
      window.AndroidTV.nativeIsActive() === true
    ) {
      window.AndroidTV.nativeToggle();
      showOsd();
      return;
    }

    if (!video) return;
    if (video.paused) video.play().catch(function () {}); else video.pause();
    showOsd();
  }''',
"toggle"
)

# 3) Seek relativo.
once(
'''  function seek(delta) {
    if (!video || !isFinite(video.duration) || video.duration <= 0) return;

    seekToTime(video.currentTime + delta);
  }''',
'''  function seek(delta) {
    if (
      window.AndroidTV &&
      typeof window.AndroidTV.nativeIsActive === "function" &&
      window.AndroidTV.nativeIsActive() === true
    ) {
      window.AndroidTV.nativeSeekBy(
        Number(delta || 0)
      );
      showOsd();
      return;
    }

    if (!video || !isFinite(video.duration) || video.duration <= 0) return;

    seekToTime(video.currentTime + delta);
  }''',
"seek relative"
)

# 4) Seek absoluto.
once(
'''  function seekToTime(seconds) {
    if (!video) return;

    if (
      !isFinite(seconds) ||''',
'''  function seekToTime(seconds) {
    if (
      window.AndroidTV &&
      typeof window.AndroidTV.nativeIsActive === "function" &&
      window.AndroidTV.nativeIsActive() === true
    ) {
      if (!isFinite(seconds)) return;
      window.AndroidTV.nativeSeekTo(
        Number(seconds)
      );
      showOsd();
      return;
    }

    if (!video) return;

    if (
      !isFinite(seconds) ||''',
"seek absolute"
)

# 5) Ajuste de imagem também controla PlayerView.
once(
'''    applyAspect();
    try { LS.setItem("stv_aspect", String(aspectIdx)); } catch (e) {}''',
'''    applyAspect();

    if (
      window.AndroidTV &&
      typeof window.AndroidTV.nativeIsActive === "function" &&
      window.AndroidTV.nativeIsActive() === true &&
      typeof window.AndroidTV.nativeSetAspect === "function"
    ) {
      window.AndroidTV.nativeSetAspect(
        aspectIdx
      );
    }

    try { LS.setItem("stv_aspect", String(aspectIdx)); } catch (e) {}''',
"aspect"
)

# 6) Ao sair/trocar mídia, encerra o ExoPlayer.
once(
'''  function destroyPlayer() {
    if (state.hls) { try { state.hls.destroy(); } catch (e) {} state.hls = null; }''',
'''  function destroyPlayer() {
    if (
      window.AndroidTV &&
      typeof window.AndroidTV.nativeIsActive === "function" &&
      window.AndroidTV.nativeIsActive() === true &&
      typeof window.AndroidTV.nativeStop === "function"
    ) {
      try {
        window.AndroidTV.nativeStop();
      } catch (e) {}

      document.documentElement.classList.remove(
        "native-player-active"
      );
    }

    if (state.hls) { try { state.hls.destroy(); } catch (e) {} state.hls = null; }''',
"destroy"
)

# 7) Histórico/continuar assistindo lê a posição do ExoPlayer.
once(
'''    var pos = video.currentTime;
    var dur = video.duration;

    saveProgress(''',
'''    var nativeActive = !!(
      window.AndroidTV &&
      typeof window.AndroidTV.nativeIsActive === "function" &&
      window.AndroidTV.nativeIsActive() === true
    );

    var pos = nativeActive
      ? Number(window.AndroidTV.nativePosition() || 0)
      : video.currentTime;

    var dur = nativeActive
      ? Number(window.AndroidTV.nativeDuration() || 0)
      : video.duration;

    saveProgress(''',
"persist native position"
)

# 8) exitPlayer também usa a posição nativa antes do stop.
once(
'''    var wasKind = state.playing ? state.playing.kind : null;
    var pos = video ? video.currentTime : 0;
    var dur = video ? video.duration : 0;''',
'''    var wasKind = state.playing ? state.playing.kind : null;

    var nativeActive = !!(
      window.AndroidTV &&
      typeof window.AndroidTV.nativeIsActive === "function" &&
      window.AndroidTV.nativeIsActive() === true
    );

    var pos = nativeActive
      ? Number(window.AndroidTV.nativePosition() || 0)
      : (video ? video.currentTime : 0);

    var dur = nativeActive
      ? Number(window.AndroidTV.nativeDuration() || 0)
      : (video ? video.duration : 0);''',
"exit native position"
)

p.write_text(s, encoding="utf-8")

print("OK: Media3 Android TV patch aplicado")
