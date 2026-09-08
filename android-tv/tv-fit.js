(function () {
  "use strict";

  function applyFit() {
    try {
      document.documentElement.classList.add("android-tv-fit");

      /*
       * Garante que não reste a classe da tentativa anterior.
       * O CSS antigo continua no arquivo compartilhado, mas não se aplica.
       */
      document.documentElement.classList.remove("android-tv-safe");
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyFit);
  } else {
    applyFit();
  }

  window.addEventListener("resize", applyFit);
})();
