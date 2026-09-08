(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function dispatchKey(code) {
    try {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          keyCode: code,
          which: code,
          bubbles: true
        })
      );
    } catch (e) {}
  }

  ready(function () {
    document.documentElement.classList.add("android-mobile");

    var meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
      );
    }

    var video = document.getElementById("video");

    if (video) {
      /*
       * No celular usamos os controles nativos do Android/WebView
       * além dos botões DarkTV de próximo episódio/ajuste.
       */
      video.controls = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");

      /*
       * Um toque no vídeo também reabre o OSD do DarkTV.
       * UP no player só chama showOsd() sem alterar a reprodução.
       */
      video.addEventListener("click", function () {
        dispatchKey(38);
      });
    }

    /*
     * Remove o brilho de foco de controle remoto depois de toque.
     * O clique continua funcionando normalmente.
     */
    document.addEventListener(
      "touchstart",
      function () {
        var focused = document.querySelectorAll(".focused");
        for (var i = 0; i < focused.length; i++) {
          focused[i].classList.remove("focused");
        }
      },
      { passive: true }
    );
  });
})();
