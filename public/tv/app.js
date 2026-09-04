/* =========================================================
   DarkTV — Xtream Codes player para LG webOS
   UI estilo streaming + navegação por controle remoto
   ========================================================= */
(function () {
  "use strict";

  /* ---------------- Utils ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LS = window.localStorage;

  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return "--:--";
    s = Math.floor(s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var p = function (n) { return n < 10 ? "0" + n : "" + n; };
    return (h > 0 ? h + ":" : "") + p(m) + ":" + p(sec);
  }

  function esc(str) { return String(str == null ? "" : str); }

  /* ERICKTV_ACCESS_GATE_V1 */
  var ACCESS_URL =
    "https://mabdjbzjgsjxbdhrkvmb.supabase.co/rest/v1/rpc/check_device_access";

  var ACCESS_KEY =
    "sb_publishable_VUiAXt82sNXB6sDk4eeQCQ_ablSGLNc";

  var PIX_CHECKOUT_URL =
    "https://mabdjbzjgsjxbdhrkvmb.supabase.co/functions/v1/pix-checkout";

  var PIX_STATUS_URL =
    "https://mabdjbzjgsjxbdhrkvmb.supabase.co/functions/v1/pix-status";

  var DEVICE_CONFIG_URL =
    "https://api.github.com/repos/limonada77/webos-showcase-player/contents/public/device-config.json?ref=main";

  var CONFIG_KEY_B64 =
    "orcOggT4W+iiKh5m3/MWqYipHn29xcnjgXV7iAdETjY=";

  function normalizeDeviceId(value) {
    var raw = String(value || "").trim().toUpperCase();
    var hex = raw.replace(/[^0-9A-F]/g, "");

    if (hex.length === 12) {
      return hex.replace(/(..)(?=.)/g, "$1:");
    }

    return raw;
  }

  function sha256hex(ascii) {
    var rightRotate = function (value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    };
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = "length";
    var i, j;
    var result = "";
    var words = [];
    var asciiBitLength = ascii[lengthProperty] * 8;

    var hash = sha256hex.h = sha256hex.h || [];
    var k = sha256hex.k = sha256hex.k || [];
    var primeCounter = k[lengthProperty];
    var isComposite = {};

    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    ascii += "\x80";
    while (ascii[lengthProperty] % 64 - 56) ascii += "\x00";

    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return "";
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }

    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = asciiBitLength;

    for (j = 0; j < words[lengthProperty];) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);

      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15];
        var w2 = w[i - 2];
        var a = hash[0];
        var e = hash[4];

        var temp1 =
          hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ ((~e) & hash[6])) +
          k[i] +
          (w[i] =
            (i < 16)
              ? w[i]
              : (
                  w[i - 16] +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
                ) | 0
          );

        var temp2 =
          (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? "0" : "") + b.toString(16);
      }
    }

    return result;
  }

  function generateLocalDeviceId() {
    var saved = "";

    try {
      saved = LS.getItem("stv_device_id_v1") || "";
    } catch (e) {}

    if (saved) return normalizeDeviceId(saved);

    var bytes = [];

    try {
      if (window.crypto && window.crypto.getRandomValues) {
        var arr = new Uint8Array(6);
        window.crypto.getRandomValues(arr);

        for (var i = 0; i < arr.length; i++) {
          bytes.push(arr[i]);
        }
      }
    } catch (e) {}

    while (bytes.length < 6) {
      bytes.push(Math.floor(Math.random() * 256));
    }

    bytes[0] = (bytes[0] | 2) & 254;

    var id = bytes.map(function (n) {
      var s = n.toString(16).toUpperCase();
      return s.length < 2 ? "0" + s : s;
    }).join(":");

    try {
      LS.setItem("stv_device_id_v1", id);
    } catch (e) {}

    return id;
  }

  function getDeviceId() {
    try {
      if (
        window.AndroidTV &&
        typeof window.AndroidTV.getDeviceId === "function"
      ) {
        var nativeId = window.AndroidTV.getDeviceId();
        if (nativeId) return normalizeDeviceId(nativeId);
      }
    } catch (e) {}

    return generateLocalDeviceId();
  }


  function base64ToBytes(value) {
    var raw = window.atob(String(value || ""));
    var out = new Uint8Array(raw.length);

    for (var i = 0; i < raw.length; i++) {
      out[i] = raw.charCodeAt(i);
    }

    return out;
  }

  function bytesToUtf8(bytes) {
    var binary = "";

    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    try {
      return decodeURIComponent(escape(binary));
    } catch (e) {
      return binary;
    }
  }

  function decryptRemoteConfig(value) {
    value = String(value || "");

    var parts = value.split(".");

    if (
      parts.length !== 3 ||
      parts[0] !== "v1" ||
      !window.crypto ||
      !window.crypto.subtle
    ) {
      return Promise.reject(
        new Error("Criptografia não suportada")
      );
    }

    var keyBytes = base64ToBytes(CONFIG_KEY_B64);
    var ivBytes = base64ToBytes(parts[1]);
    var encryptedBytes = base64ToBytes(parts[2]);

    return window.crypto.subtle
      .importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      )
      .then(function (key) {
        return window.crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: ivBytes,
            tagLength: 128
          },
          key,
          encryptedBytes
        );
      })
      .then(function (plain) {
        return bytesToUtf8(
          new Uint8Array(plain)
        );
      });
  }

  function remoteEntryStorageKey() {
    return "stv_remote_entry_v2:" +
      String(state.accessHash || "");
  }

  function accessPolicyStorageKey() {
    return "stv_access_policy_v2:" +
      String(state.accessHash || "");
  }

  function pixPolicyStorageKey() {
    return "stv_pix_policy_v2:" +
      String(state.accessHash || "");
  }

  function readJsonStorage(key) {
    try {
      return JSON.parse(
        LS.getItem(key) || "null"
      );
    } catch (e) {
      return null;
    }
  }

  function writeJsonStorage(key, value) {
    try {
      LS.setItem(
        key,
        JSON.stringify(value)
      );
    } catch (e) {}
  }

  function getCachedRemoteEntry() {
    return readJsonStorage(
      remoteEntryStorageKey()
    );
  }

  function cacheRemoteEntry(entry) {
    if (!entry) return;

    writeJsonStorage(
      remoteEntryStorageKey(),
      entry
    );
  }

  function getCachedAccessPolicy() {
    return readJsonStorage(
      accessPolicyStorageKey()
    );
  }

  function cacheAccessPolicy(policy) {
    if (!policy) return;

    writeJsonStorage(
      accessPolicyStorageKey(),
      policy
    );
  }

  function addCalendarMonthsIso(start, months) {
    var d = new Date(start.getTime());
    var day = d.getDate();

    d.setDate(1);
    d.setMonth(
      d.getMonth() + months
    );

    var lastDay =
      new Date(
        d.getFullYear(),
        d.getMonth() + 1,
        0
      ).getDate();

    d.setDate(
      Math.min(day, lastDay)
    );

    return d.toISOString();
  }

  function policyFromEntry(entry) {
    if (!entry) return null;

    return {
      source:
        String(entry.source || "admin"),
      duration:
        String(entry.duration || "forever"),
      expiresAt:
        entry.expiresAt
          ? String(entry.expiresAt)
          : null
    };
  }

  function isPolicyValid(policy) {
    if (!policy) return false;

    if (!policy.expiresAt) {
      return true;
    }

    var expires =
      Date.parse(policy.expiresAt);

    return (
      isFinite(expires) &&
      expires > Date.now()
    );
  }

  function fetchRemoteDeviceEntry(force) {
    var now = Date.now();

    if (
      !force &&
      state.remoteEntryLoaded &&
      now - state.remoteEntryFetchedAt < 30000
    ) {
      return Promise.resolve(
        state.remoteEntry
      );
    }

    return fetch(
      DEVICE_CONFIG_URL +
        "&ts=" + now,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          "Accept":
            "application/vnd.github+json"
        }
      }
    )
      .then(function (r) {
        if (!r.ok) {
          throw new Error(
            "HTTP " + r.status
          );
        }

        return r.json();
      })
      .then(function (payload) {
        var encoded =
          payload &&
          payload.content
            ? String(
                payload.content
              ).replace(/\s+/g, "")
            : "";

        var data =
          encoded
            ? JSON.parse(
                window.atob(encoded)
              )
            : { devices: [] };

        var list =
          data &&
          Array.isArray(data.devices)
            ? data.devices
            : [];

        var found = null;

        for (
          var i = 0;
          i < list.length;
          i++
        ) {
          var item = list[i];

          if (
            item &&
            String(
              item.hash || ""
            ).toLowerCase() ===
              state.accessHash
          ) {
            found = item;
            break;
          }
        }

        state.remoteEntryLoaded = true;
        state.remoteEntryFetchedAt = now;
        state.remoteEntry = found;

        if (found) {
          cacheRemoteEntry(found);
        }

        return found;
      })
      .catch(function () {
        var cached =
          getCachedRemoteEntry();

        if (cached) {
          state.remoteEntryLoaded = true;
          state.remoteEntry = cached;
          return cached;
        }

        return null;
      });
  }

  function applyRemoteXtream(entry) {
    if (
      !entry ||
      !entry.xtream_enc
    ) {
      return Promise.resolve(null);
    }

    return decryptRemoteConfig(
      entry.xtream_enc
    )
      .then(function (plain) {
        var raw = JSON.parse(plain);

        if (
          !raw ||
          !raw.host ||
          !raw.user ||
          !raw.pass
        ) {
          return null;
        }

        var profile = {
          host: normHost(raw.host),
          user: String(raw.user),
          pass: String(raw.pass)
        };

        try {
          LS.setItem(
            "stv_profile",
            JSON.stringify(profile)
          );
        } catch (e) {}

        try {
          upsertList(profile);
        } catch (e) {}

        state.profile = profile;

        var hostInput = $("#in-host");
        var userInput = $("#in-user");
        var passInput = $("#in-pass");
        var userName = $("#user-name");

        if (hostInput) {
          hostInput.value =
            profile.host;
        }

        if (userInput) {
          userInput.value =
            profile.user;
        }

        if (passInput) {
          passInput.value =
            profile.pass;
        }

        if (userName) {
          userName.textContent =
            profile.user;
        }

        return profile;
      })
      .catch(function () {
        return null;
      });
  }

  function schedulePolicyExpiry(policy) {
    if (state.expiryTimer) {
      clearTimeout(
        state.expiryTimer
      );
      state.expiryTimer = null;
    }

    if (
      !policy ||
      !policy.expiresAt
    ) {
      return;
    }

    var expires =
      Date.parse(
        policy.expiresAt
      );

    if (!isFinite(expires)) {
      return;
    }

    function arm() {
      var remaining =
        expires - Date.now();

      if (remaining <= 0) {
        state.expiryTimer =
          null;

        lockAccess(
          "Acesso vencido. Renove pelo PIX ou Admin."
        );

        return;
      }

      /*
       * setTimeout de browsers antigos tem limite
       * perto de 24,8 dias. Para 1 mês/1 ano,
       * rearmamos em blocos até chegar ao instante exato.
       */
      state.expiryTimer =
        setTimeout(
          arm,
          Math.min(
            remaining,
            2000000000
          )
        );
    }

    arm();
  }

  function stopLockedTimers() {
    if (state.accessTimer) {
      clearInterval(
        state.accessTimer
      );
      state.accessTimer = null;
    }

    if (state.pixTimer) {
      clearInterval(
        state.pixTimer
      );
      state.pixTimer = null;
    }
  }

  function startLockedTimers() {
    if (!state.accessTimer) {
      state.accessTimer =
        setInterval(
          checkAccessNow,
          500
        );
    }

    if (!state.pixTimer) {
      state.pixTimer =
        setInterval(
          loadPixCheckout,
          10000
        );
    }
  }

  function unlockAccess(
    policy,
    remoteProfile
  ) {
    state.accessLocked = false;
    state.currentPolicy =
      policy || null;

    if (policy) {
      cacheAccessPolicy(policy);
    }

    try {
      LS.removeItem(
        "stv_access_permanent_v1"
      );

      LS.setItem(
        "stv_access_granted_hash",
        state.accessHash || ""
      );
    } catch (e) {}

    try {
      document.documentElement
        .classList.remove(
          "access-permanent"
        );
    } catch (e) {}

    var gate =
      $("#access-gate");

    if (gate) {
      gate.style.display =
        "none";
    }

    stopLockedTimers();

    if (state.leaseTimer) {
      clearInterval(
        state.leaseTimer
      );
    }

    schedulePolicyExpiry(
      state.currentPolicy
    );

    state.leaseTimer =
      setInterval(
        checkUnlockedLease,
        2000
      );

    if (
      state.screen !==
      "menu"
    ) {
      goMenu();
    }

    if (remoteProfile) {
      setTimeout(
        function () {
          doLogin(
            remoteProfile,
            true
          ).catch(
            function () {}
          );
        },
        80
      );
    }
  }

  function lockAccess(message) {
    state.accessLocked = true;
    state.accessResolving = false;

    if (state.leaseTimer) {
      clearInterval(
        state.leaseTimer
      );
      state.leaseTimer = null;
    }

    if (state.expiryTimer) {
      clearTimeout(
        state.expiryTimer
      );
      state.expiryTimer = null;
    }

    var gate =
      $("#access-gate");

    if (gate) {
      gate.style.display =
        "block";
    }

    var status =
      $("#access-status");

    if (status && message) {
      status.textContent =
        message;
    }

    loadPixCheckout();
    startLockedTimers();
  }

  function fetchPixPolicy() {
    var now = Date.now();

    if (
      state.pixStatusPromise &&
      now - state.pixStatusFetchedAt < 1000
    ) {
      return state.pixStatusPromise;
    }

    state.pixStatusFetchedAt = now;

    state.pixStatusPromise =
      fetch(
        PIX_STATUS_URL,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            device_hash:
              state.accessHash
          })
        }
      )
        .then(function (r) {
          if (!r.ok) {
            throw new Error(
              "HTTP " + r.status
            );
          }

          return r.json();
        })
        .then(function (data) {
          if (
            !data ||
            data.paid !== true ||
            !data.paid_at
          ) {
            return null;
          }

          var paidAt =
            new Date(
              String(
                data.paid_at
              )
            );

          if (
            !isFinite(
              paidAt.getTime()
            )
          ) {
            return null;
          }

          var policy = {
            source: "pix",
            duration: "month",
            paidAt:
              paidAt.toISOString(),
            expiresAt:
              addCalendarMonthsIso(
                paidAt,
                1
              )
          };

          writeJsonStorage(
            pixPolicyStorageKey(),
            policy
          );

          return policy;
        })
        .catch(function () {
          return readJsonStorage(
            pixPolicyStorageKey()
          );
        })
        .then(function (policy) {
          state.pixStatusPromise =
            null;

          return policy;
        });

    return state.pixStatusPromise;
  }

  function resolveGrantedAccess() {
    if (
      !state.accessLocked ||
      state.accessResolving
    ) {
      return;
    }

    state.accessResolving = true;

    fetchRemoteDeviceEntry(false)
      .then(function (entry) {
        if (entry) {
          var policy =
            policyFromEntry(entry);

          if (
            entry.active === false ||
            !isPolicyValid(policy)
          ) {
            cacheAccessPolicy(
              policy
            );

            var status =
              $("#access-status");

            if (status) {
              status.textContent =
                "Acesso vencido. Renove pelo PIX ou Admin.";
            }

            state.currentPolicy =
              policy;

            return null;
          }

          return applyRemoteXtream(
            entry
          ).then(function (profile) {
            unlockAccess(
              policy,
              profile
            );

            return true;
          });
        }

        /*
         * Sem política do Admin:
         * consulta o pagamento confirmado pelo webhook.
         * O horário vem do Supabase/Stripe, então o mês
         * começa no instante em que o pagamento foi aceito.
         */
        return fetchPixPolicy()
          .then(function (pixPolicy) {
            if (!pixPolicy) {
              var waitingPix =
                $("#access-status");

              if (waitingPix) {
                waitingPix.textContent =
                  "Aguardando pagamento PIX...";
              }

              return null;
            }

            if (
              !isPolicyValid(
                pixPolicy
              )
            ) {
              var pixStatus =
                $("#access-status");

              if (pixStatus) {
                pixStatus.textContent =
                  "Acesso PIX vencido. Faça um novo pagamento.";
              }

              state.currentPolicy =
                pixPolicy;

              return null;
            }

            unlockAccess(
              pixPolicy,
              null
            );

            return true;
          });
      })
      .then(
        function (value) {
          state.accessResolving =
            false;

          return value;
        },
        function () {
          state.accessResolving =
            false;
        }
      );
  }

  function requestAccessState() {
    return fetch(
      ACCESS_URL,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type":
            "application/json",
          "apikey":
            ACCESS_KEY,
          "Authorization":
            "Bearer " +
            ACCESS_KEY
        },
        body: JSON.stringify({
          p_hash:
            state.accessHash
        })
      }
    )
      .then(function (r) {
        if (!r.ok) {
          throw new Error(
            "HTTP " + r.status
          );
        }

        return r.json();
      })
      .then(function (granted) {
        return granted === true;
      });
  }

  function checkAccessNow() {
    if (!state.accessLocked) {
      return;
    }

    requestAccessState()
      .then(function (granted) {
        if (granted) {
          var status =
            $("#access-status");

          if (status) {
            status.textContent =
              "Liberação encontrada. Validando acesso...";
          }

          resolveGrantedAccess();
          return;
        }

        state.remoteEntryLoaded =
          false;
        state.remoteEntry =
          null;

        var status =
          $("#access-status");

        if (status) {
          status.textContent =
            "Aguardando liberação...";
        }
      })
      .catch(function () {
        var status =
          $("#access-status");

        if (status) {
          status.textContent =
            "Aguardando liberação...";
        }
      });
  }

  function checkUnlockedLease() {
    if (state.accessLocked) {
      return;
    }

    if (
      state.currentPolicy &&
      !isPolicyValid(
        state.currentPolicy
      )
    ) {
      lockAccess(
        "Acesso vencido. Renove pelo PIX ou Admin."
      );
      return;
    }

    requestAccessState()
      .then(function (granted) {
        if (!granted) {
          state.remoteEntryLoaded =
            false;

          lockAccess(
            "Acesso aguardando renovação..."
          );
        }
      })
      .catch(function () {
        /*
         * Se a internet oscilar, não derruba
         * uma sessão ainda dentro do prazo.
         */
      });
  }

  function loadPixCheckout() {
    if (
      !state.accessLocked ||
      !state.accessHash
    ) {
      return;
    }

    var qr =
      $("#access-qr");

    var paymentStatus =
      $("#access-payment-status");

    fetch(
      PIX_CHECKOUT_URL,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          device_hash:
            state.accessHash
        })
      }
    )
      .then(function (r) {
        if (!r.ok) {
          throw new Error(
            "HTTP " + r.status
          );
        }

        return r.json();
      })
      .then(function (data) {
        if (
          !data ||
          data.ready !== true ||
          !data.qr_data_url
        ) {
          if (qr) {
            qr.removeAttribute(
              "src"
            );
            qr.style.display =
              "none";
          }

          if (paymentStatus) {
            paymentStatus.textContent =
              "PIX automático aguardando ativação.";
          }

          return;
        }

        if (qr) {
          qr.src =
            data.qr_data_url;

          qr.style.display =
            "block";
        }

        if (paymentStatus) {
          paymentStatus.textContent =
            "Escaneie o QR Code e pague R$ 25,00. O acesso será válido por 1 mês.";
        }
      })
      .catch(function () {
        if (qr) {
          qr.removeAttribute(
            "src"
          );
          qr.style.display =
            "none";
        }

        if (paymentStatus) {
          paymentStatus.textContent =
            "PIX automático temporariamente indisponível.";
        }
      });
  }

  function initAccessGate() {
    var id =
      getDeviceId();

    var normalized =
      normalizeDeviceId(id);

    state.accessDeviceId =
      normalized;

    state.accessHash =
      sha256hex(normalized);

    var el =
      $("#access-device-id");

    if (el) {
      el.textContent =
        normalized;
    }

    try {
      LS.removeItem(
        "stv_access_permanent_v1"
      );

      document.documentElement
        .classList.remove(
          "access-permanent"
        );
    } catch (e) {}

    var cachedPolicy =
      getCachedAccessPolicy();

    if (
      cachedPolicy &&
      isPolicyValid(
        cachedPolicy
      )
    ) {
      unlockAccess(
        cachedPolicy,
        null
      );

      /*
       * Revalida silenciosamente no backend.
       */
      checkUnlockedLease();
      return;
    }

    state.accessLocked = true;

    loadPixCheckout();
    checkAccessNow();
    startLockedTimers();
  }

  /* ---------------- Estado ---------------- */
  var state = {
    profile: null,           // {host, user, pass}
    screen: "menu",
    live: { cats: [], items: [], cat: null },
    movies: { cats: [], items: [], cat: null },
    series: { cats: [], items: [], cat: null },
    gridKind: "live",
    detail: null,
    seriesInfo: null,
    season: null,
    playing: null,
    hls: null,
    lastFocus: {},
    accessLocked: true,
    accessDeviceId: "",
    accessHash: "",
    accessTimer: null,
    pixTimer: null,
    leaseTimer: null,
    expiryTimer: null,
    accessResolving: false,
    currentPolicy: null,
    remoteEntry: null,
    remoteEntryLoaded: false,
    remoteEntryFetchedAt: 0,
    pixStatusFetchedAt: 0,
    pixStatusPromise: null
  };

  /* ---------------- Cache rápido ---------------- */

  var CATALOG_CACHE_KEY = "stv_catalog_cache_v1";

  function saveCatalogCache() {
    try {
      /*
       * Cache leve para abrir a HOME instantaneamente.
       *
       * Não salvamos listas gigantes inteiras para não
       * estourar o limite do localStorage das TVs LG.
       */
      var cache = {
        live: {
          cats: state.live.cats.slice(0, 30),
          items: state.live.items.slice(0, 80)
        },

        movies: {
          cats: state.movies.cats.slice(0, 30),
          items: state.movies.items.slice(0, 120)
        },

        series: {
          cats: state.series.cats.slice(0, 30),
          items: state.series.items.slice(0, 120)
        },

        savedAt: Date.now()
      };

      LS.setItem(
        CATALOG_CACHE_KEY,
        JSON.stringify(cache)
      );
    } catch (e) {
      /*
       * Cache é opcional.
       * Se a TV tiver pouco espaço, o app continua normal.
       */
    }
  }

  function restoreCatalogCache() {
    try {
      var raw = LS.getItem(CATALOG_CACHE_KEY);

      if (!raw) return false;

      var cache = JSON.parse(raw);

      if (!cache) return false;

      state.live.cats =
        (cache.live && cache.live.cats) || [];

      state.live.items =
        (cache.live && cache.live.items) || [];

      state.movies.cats =
        (cache.movies && cache.movies.cats) || [];

      state.movies.items =
        (cache.movies && cache.movies.items) || [];

      state.series.cats =
        (cache.series && cache.series.cats) || [];

      state.series.items =
        (cache.series && cache.series.items) || [];

      return Boolean(
        state.movies.items.length ||
        state.series.items.length ||
        state.live.items.length
      );

    } catch (e) {
      return false;
    }
  }

  /* ---------------- API Xtream ---------------- */
  function apiBase() {
    var p = state.profile;
    return p.host + "/player_api.php?username=" + encodeURIComponent(p.user) +
      "&password=" + encodeURIComponent(p.pass);
  }

  function api(action, params) {
    var url = apiBase() + (action ? "&action=" + action : "");
    if (params) for (var k in params) url += "&" + k + "=" + encodeURIComponent(params[k]);
    return fetch(url, { method: "GET" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function normHost(h) {
    h = (h || "").trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(h)) h = "http://" + h;
    return h;
  }

  function streamUrl(kind, item) {
    var p = state.profile;
    var base = p.host + "/" + kind + "/" + encodeURIComponent(p.user) + "/" + encodeURIComponent(p.pass) + "/";
    if (kind === "live") return base + item.stream_id + ".m3u8";
    var ext = item.container_extension || "mp4";
    return base + (item.stream_id || item.id) + "." + ext;
  }

  /* ---------------- Navegação espacial ---------------- */
  function focusables() {
    var scr = $("#screen-" + state.screen);
    if (!scr) return [];
    return $$(".focusable", scr).filter(function (el) {
      return el.offsetParent !== null || el.offsetWidth > 0;
    });
  }

  var current = null;

  function setFocus(el) {
    if (!el) return;
    if (current && current !== el) {
      current.classList.remove("focused");
      if (current.blur) current.blur();
    }
    current = el;
    el.classList.add("focused");
    if (el.tagName === "INPUT") el.focus();
    state.lastFocus[state.screen] = el;
    ensureVisible(el);
  }

  function ensureVisible(el) {
    // rolagem horizontal dentro de uma trilha
    var track = el.closest ? el.closest(".row-track") : null;
    if (track) {
      var trackRect = track.parentElement.getBoundingClientRect();
      var r = el.getBoundingClientRect();
      var cur = parseFloat(track.dataset.x || "0");
      var pad = 48;
      if (r.left < trackRect.left + pad) cur += (trackRect.left + pad - r.left);
      else if (r.right > trackRect.right - pad) cur -= (r.right - (trackRect.right - pad));
      if (cur > 0) cur = 0;
      track.dataset.x = cur;
      track.style.transform = "translateX(" + cur + "px)";
    }
    // rolagem vertical de containers (inclui a lista de episódios)
    var scroller = el.closest ? el.closest(".rows, .grid, .cats") : null;
    if (scroller) {
      var sr = scroller.getBoundingClientRect();
      var er = el.getBoundingClientRect();
      if (er.bottom > sr.bottom - 10) scroller.scrollTop += (er.bottom - sr.bottom + 40);
      else if (er.top < sr.top + 10) scroller.scrollTop -= (sr.top - er.top + 40);
      if (scroller.id === "grid-items") maybeLoadMoreGrid(scroller);
    }
  }

  function move(dir) {
    var list = focusables();
    if (!list.length) return;
    if (!current || list.indexOf(current) === -1) { setFocus(list[0]); return; }
    /* ERICKTV_CATEGORY_NAV_V72
     * ▲/▼ ficam nos gêneros; ▶ entra nos conteúdos.
     */
    var inCats = current.closest && current.closest(".cats");

    if (inCats && (dir === "up" || dir === "down")) {
      list = list.filter(function (el) { return inCats.contains(el); });
    }

    if (inCats && dir === "right") {
      var firstContent = $("#grid-items .card.focusable");
      if (firstContent) {
        setFocus(firstContent);
        return;
      }
    }
    var cr = current.getBoundingClientRect();
    var cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    var best = null, bestScore = Infinity;

    list.forEach(function (el) {
      if (el === current) return;
      var r = el.getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var dx = x - cx, dy = y - cy;
      var ok = (dir === "left" && dx < -8) || (dir === "right" && dx > 8) ||
        (dir === "up" && dy < -8) || (dir === "down" && dy > 8);
      if (!ok) return;
      var primary = (dir === "left" || dir === "right") ? Math.abs(dx) : Math.abs(dy);
      var cross = (dir === "left" || dir === "right") ? Math.abs(dy) : Math.abs(dx);
      var score = primary + cross * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) setFocus(best);
  }

  /* ---------------- Telas ---------------- */
  function show(name) {
    state.screen = name;
    $$(".screen").forEach(function (s) { s.classList.remove("active"); });
    $("#screen-" + name).classList.add("active");
    var prev = state.lastFocus[name];
    setTimeout(function () {
      var list = focusables();
      setFocus(prev && list.indexOf(prev) !== -1 ? prev : list[0]);
    }, 30);
  }

  /* ---------------- Login ---------------- */
  function doLogin(profile, silent) {
    state.profile = profile;
    $("#login-msg").textContent = "";
    if (!silent) $("#login-msg").textContent = "Conectando…";
    return api("").then(function (data) {
      if (!data || !data.user_info || String(data.user_info.auth) !== "1") {
        throw new Error("Usuário ou senha inválidos");
      }
      state.userInfo = data.user_info;
      state.serverInfo = data.server_info || null;
      LS.setItem("stv_profile", JSON.stringify(profile));
      upsertList(profile);
      state.addingList = false;
      $("#user-name").textContent = profile.user;
      renderProfile();
      return loadCatalog();
    }).catch(function (e) {
      state.profile = null;
      $("#login-msg").textContent = "Falha ao conectar: " + e.message +
        " — verifique servidor, usuário e senha (e a conexão da TV).";
      if (silent) goMenu();
      else show("login");
      throw e;
    });
  }

  function loadCatalog() {
    $("#login-msg").textContent = "Carregando catálogo…";
    return Promise.all([
      api("get_live_categories").catch(function () { return []; }),
      api("get_vod_categories").catch(function () { return []; }),
      api("get_series_categories").catch(function () { return []; }),
      api("get_vod_streams").catch(function () { return []; }),
      api("get_series").catch(function () { return []; }),
      api("get_live_streams").catch(function () { return []; })
    ]).then(function (res) {
      state.live.cats = res[0] || [];
      state.movies.cats = res[1] || [];
      state.series.cats = res[2] || [];
      state.movies.items = res[3] || [];
      state.series.items = res[4] || [];
      state.live.items = res[5] || [];

      /*
       * Guarda uma versão leve para a próxima abertura.
       */
      saveCatalogCache();

      buildHome();
      buildMenu();
      if (state.screen === "login" || state.screen === "home" || state.screen === "menu" || !state.screen) goMenu();
    });
  }

  function refreshCatalog() {

    if (!state.profile) {
      toast("Adicione uma lista em Listas.");
      return;
    }

    toast("Atualizando conteúdos…");

    loadCatalog()
      .then(function () {
        toast("Conteúdos atualizados.");
      })
      .catch(function () {
        toast("Não foi possível atualizar agora.");
      });
  }

  /* ---------------- Home ---------------- */
  function normalizeImageUrl(url) {
    url = String(url || "").trim();

    if (!url) return "";

    if (/^\/\//.test(url)) {
      var proto =
        state.profile &&
        /^https:\/\//i.test(state.profile.host || "")
          ? "https:"
          : "http:";

      return proto + url;
    }

    if (/^\//.test(url) && state.profile && state.profile.host) {
      return state.profile.host.replace(/\/+$/, "") + url;
    }

    return url;
  }

  function imageCandidates(it) {
    it = it || {};

    var values = [
      it.stream_icon,
      it.cover,
      it.series_cover,
      it.movie_image,
      it.cover_big,
      it.poster,
      it.poster_url,
      it.poster_path,
      it.image,
      it.icon,
      it.logo
    ];

    if (it.backdrop_path) {
      if (Array.isArray(it.backdrop_path)) {
        values.push(it.backdrop_path[0]);
      } else {
        values.push(it.backdrop_path);
      }
    }

    var out = [];

    values.forEach(function (value) {
      var url = normalizeImageUrl(value);

      if (!url) return;

      if (out.indexOf(url) === -1) {
        out.push(url);
      }

      var alternate = "";

      if (/^https:\/\//i.test(url)) {
        alternate = url.replace(/^https:\/\//i, "http://");
      } else if (/^http:\/\//i.test(url)) {
        alternate = url.replace(/^http:\/\//i, "https://");
      }

      if (alternate && out.indexOf(alternate) === -1) {
        out.push(alternate);
      }
    });

    return out;
  }

  function pickImage(it) {
    var list = imageCandidates(it);
    return list.length ? list[0] : "";
  }

  function loadSmartImage(img, item, onFail) {
    var urls = imageCandidates(item);
    var index = 0;

    function next() {
      if (index >= urls.length) {
        img.onerror = null;

        if (onFail) {
          onFail();
        }

        return;
      }

      var url = urls[index++];

      img.onerror = function () {
        next();
      };

      try {
        img.referrerPolicy = "no-referrer";
      } catch (e) {
        // webOS antigo pode não suportar referrerPolicy
      }

      img.src = url;
    }

    next();
  }

  function makeCard(item, kind, poster) {
    var el = document.createElement("div");
    el.className = "card focusable" + (poster ? " poster" : "");
    var img = pickImage(item);
    var name = esc(item.name || item.title);

    if (img) {
      el.innerHTML = '<img loading="lazy" alt=""><div class="cap"></div>';

      var im = el.firstChild;

      el.querySelector(".cap").textContent = name;

      loadSmartImage(im, item, function () {
        el.innerHTML = '<div class="ph"></div>';
        el.firstChild.textContent = name;
      });

    } else {
      el.innerHTML = '<div class="ph"></div>';
      el.firstChild.textContent = name;
    }
    el.addEventListener("click", function () { openItem(item, kind); });
    el._item = item; el._kind = kind;
    return el;
  }

  function makeRow(title, items, kind, poster) {
    if (!items || !items.length) return null;
    var row = document.createElement("div");
    row.className = "row";
    var h = document.createElement("h2");
    h.textContent = title;
    var track = document.createElement("div");
    track.className = "row-track";
    items.slice(0, 24).forEach(function (it) { track.appendChild(makeCard(it, kind, poster)); });
    row.appendChild(h); row.appendChild(track);
    return row;
  }

  function byCategory(list, catId) {
    return list.filter(function (i) { return String(i.category_id) === String(catId); });
  }

  /* Fila de linhas da home: TODAS as categorias de filmes e séries,
     renderizadas em blocos conforme o usuário desce. */
  var homeQueue = [];
  var HOME_CHUNK = 8;

  function buildHomeQueue() {
    homeQueue = [];
    homeQueue.push({ title: "Filmes em alta", items: state.movies.items.slice(0, 24), kind: "movie", poster: true });
    homeQueue.push({ title: "Séries para maratonar", items: state.series.items.slice(0, 24), kind: "series", poster: true });
    homeQueue.push({ title: "Canais ao vivo", items: state.live.items.slice(0, 24), kind: "live", poster: false });

    state.movies.cats.forEach(function (c) {
      var items = byCategory(state.movies.items, c.category_id);
      if (items.length > 3) homeQueue.push({ title: c.category_name, items: items, kind: "movie", poster: true });
    });
    state.series.cats.forEach(function (c) {
      var items = byCategory(state.series.items, c.category_id);
      if (items.length > 3) homeQueue.push({ title: c.category_name, items: items, kind: "series", poster: true });
    });
  }

  function renderMoreHomeRows() {
    var rows = $("#rows");
    var n = 0;
    while (homeQueue.length && n < HOME_CHUNK) {
      var d = homeQueue.shift();
      var r = makeRow(d.title, d.items, d.kind, d.poster);
      if (r) { rows.appendChild(r); n++; }
    }
  }

  function maybeLoadMoreHome() {
    var rows = $("#rows");
    if (!homeQueue.length) return;
    if (rows.scrollTop + rows.clientHeight > rows.scrollHeight - 900) renderMoreHomeRows();
  }

  function buildHome() {
    var rows = $("#rows");
    rows.innerHTML = "";
    rows.scrollTop = 0;
    buildHomeQueue();
    renderMoreHomeRows();
    startBillboardRotation();
  }


  /* ---------------- Menu principal (launcher) ---------------- */
  function buildMenu() {
    var track = $("#menu-strip-track");
    var strip = track ? track.parentNode : null;
    if (!track || !strip) return;
    track.innerHTML = "";
    /* Na tela inicial só mostramos os recém-adicionados;
       "Continuar assistindo" fica apenas dentro das categorias. */
    var items = recentlyAdded(state.movies.items || [], 20);
    var kindOf = function (it) { return it._kind || (it.series_id ? "series" : (it.stream_type === "live" ? "live" : "movie")); };
    var title = "Adicionados recentemente";
    if (!items.length) { strip.classList.add("empty"); }
    else {
      strip.classList.remove("empty");
      $("#menu-strip-title").textContent = title;
      items.slice(0, 20).forEach(function (it) {
        var c = makeCard(it, kindOf(it), true);
        if (c) track.appendChild(c);
      });
    }
    var u = state.userInfo || {};
    var pr = state.profile || {};
    $("#mf-user").textContent = "Usuário: " + (pr.user || "—");
    $("#mf-exp").textContent = "Vencimento: " + fmtDate(u.exp_date);
    $("#mf-host").textContent = pr.host || "";
  }

  function goMenu() {
    buildMenu();
    setActiveTab("home");
    show("menu");
  }

  /* ERICKTV_HOME_FIRST_V74
   * O launcher (screen-menu) é a Home oficial.
   * Login Xtream só abre quando o usuário entra em Listas.
   */
  function openListLogin() {
    state.addingList = true;
    $("#login-msg").textContent = "Adicione uma lista Xtream.";
    $("#in-host").value = "";
    $("#in-user").value = "";
    $("#in-pass").value = "";
    show("login");
  }

  /* ---------------- Billboard rotativo ---------------- */
  var bbTimer = null;
  var bbPool = [];
  var bbIndex = -1;

  function startBillboardRotation() {
    stopBillboardRotation();
    bbPool = state.movies.items.filter(function (m) { return pickImage(m); }).slice(0, 40);
    if (!bbPool.length && state.series.items.length) {
      bbPool = state.series.items.filter(function (m) { return pickImage(m); }).slice(0, 40);
    }
    if (!bbPool.length && state.live.items.length) bbPool = [state.live.items[0]];
    if (!bbPool.length) return;
    bbIndex = Math.floor(Math.random() * bbPool.length);
    setBillboard(bbPool[bbIndex]);
    bbTimer = setInterval(function () {
      if (state.screen !== "home" || !bbPool.length) return;
      bbIndex = (bbIndex + 1) % bbPool.length;
      fadeBillboard(bbPool[bbIndex]);
    }, 8000);
  }

  function stopBillboardRotation() {
    if (bbTimer) { clearInterval(bbTimer); bbTimer = null; }
  }

  function fadeBillboard(item) {
    var el = $("#bb-img");
    el.style.opacity = "0";
    setTimeout(function () {
      setBillboard(item);
      el.style.opacity = "1";
    }, 450);
  }

  function setBillboard(item) {
    if (!item) return;
    state.hero = item;
    $("#bb-title").textContent = esc(item.name || item.title);
    $("#bb-kicker").textContent = item.stream_type === "live" ? "Ao vivo agora" : "Em destaque";
    $("#bb-desc").textContent = esc(item.plot || item.description || "Assista agora em alta qualidade no seu DarkTV.");
    var img = pickImage(item);
    var el = $("#bb-img");
    if (img) { el.src = img; el.style.display = "block"; } else { el.style.display = "none"; }
    state.heroKind = item.series_id ? "series" : (item.stream_type === "live" ? "live" : "movie");
  }

  /* ERICKTV_HISTORY_V72
   * Continuar assistindo e progresso persistentes por conta Xtream.
   */

  function historyKey(part) {
    var p = state.profile || {};
    var account = String(p.host || "") + "|" + String(p.user || "");
    return "stv_watch_v72:" + encodeURIComponent(account) + ":" + part;
  }

  function readHistory(part, fallback) {
    try {
      var raw = LS.getItem(historyKey(part));
      if (!raw) return fallback;
      var value = JSON.parse(raw);
      return value != null ? value : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeHistory(part, value) {
    try {
      LS.setItem(historyKey(part), JSON.stringify(value));
    } catch (e) {}
  }

  function clearHistory() {
    try {
      LS.removeItem(historyKey("continue"));
      LS.removeItem(historyKey("progress"));
      LS.removeItem("stv_continue");
      LS.removeItem("stv_progress_v1");
    } catch (e) {}
  }

  function getContinue() {
    var list = readHistory("continue", []);
    return Array.isArray(list) ? list : [];
  }

  function setContinue(list) {
    writeHistory("continue", list.slice(0, 30));
  }

  function continueKey(item, kind) {
    if (!item) return "";

    /* Uma série inteira usa somente um cartão. */
    if (kind === "series" && (item._series_id || item.series_id)) {
      return "series:" + String(item._series_id || item.series_id);
    }

    return String(kind || item._kind || "movie") + ":" +
      String(item.stream_id || item.id || item.name || "");
  }

  function removeContinue(item, kind) {
    var key = continueKey(item, kind);
    var list = getContinue().filter(function (old) {
      var oldKey = old._continueKey || continueKey(old, old._kind || kind);
      return oldKey !== key;
    });
    setContinue(list);
  }

  function saveContinue(item, kind, pos) {
    if (!item || kind === "live") return;

    var rec;
    try {
      rec = JSON.parse(JSON.stringify(item));
    } catch (e) {
      return;
    }

    rec._kind = kind;
    rec._pos = Math.floor(pos || 0);

    /*
     * ERICKTV_SERIES_SAVE_FIX_V73
     *
     * Antes de salvar o episódio, recupera a série
     * original para garantir nome e capa corretos.
     */
    if (kind === "series") {

      var contextSeries =
        state.detail &&
        state.detail.kind === "series"
          ? state.detail.item
          : null;

      /*
       * Caso o episódio não tenha recebido series_id,
       * recuperamos pelo contexto da tela de série.
       */
      if (
        !rec._series_id &&
        contextSeries &&
        contextSeries.series_id
      ) {

        rec._series_id =
          contextSeries.series_id;

        rec.series_id =
          contextSeries.series_id;
      }


      var seriesSource =
        null;


      if (
        rec._series_id
      ) {

        var seriesCatalog =
          state.series.items ||
          [];


        for (
          var si = 0;
          si < seriesCatalog.length;
          si++
        ) {

          if (
            String(
              seriesCatalog[si].series_id
            ) ===
            String(
              rec._series_id
            )
          ) {

            seriesSource =
              seriesCatalog[si];

            break;
          }
        }
      }


      if (
        !seriesSource &&
        contextSeries
      ) {

        seriesSource =
          contextSeries;
      }


      if (
        seriesSource
      ) {

        rec._series_name =
          seriesSource.name ||
          seriesSource.title ||
          rec._series_name ||
          "";

        rec._series_cover =
          pickImage(
            seriesSource
          ) ||
          rec._series_cover ||
          "";
      }
    }


    /* Série: o cartão mostra a série, mas guarda o último episódio. */
    if (kind === "series" && rec._series_id) {
      var playName = rec.name || rec.title || "Episódio";

      rec._resumeEpisode = true;
      rec._episode_play_name = playName;
      rec.series_id = rec._series_id;
      rec._continueKey = "series:" + String(rec._series_id);

      rec.name = rec._series_name || playName;
      rec.title = rec.name;

      if (rec._series_cover) {
        rec.stream_icon = rec._series_cover;
        rec.cover = rec._series_cover;
        rec.series_cover = rec._series_cover;
        rec.movie_image = rec._series_cover;
      }
    } else {
      rec._continueKey = continueKey(rec, kind);
    }

    var key = rec._continueKey || continueKey(rec, kind);
    var list = getContinue().filter(function (old) {
      var oldKey = old._continueKey || continueKey(old, old._kind || kind);
      return oldKey !== key;
    });

    list.unshift(rec);
    setContinue(list);
  }

  function getProgressMap() {
    var map = readHistory("progress", {});
    return map && typeof map === "object" && !Array.isArray(map) ? map : {};
  }

  function setProgressMap(map) {
    writeHistory("progress", map);
  }

  function progressKey(item, kind) {
    return kind + ":" + String(item.stream_id || item.id || item.name || "");
  }

  function saveProgress(item, kind, pos, dur) {
    if (kind === "live" || !item) return;
    if (!isFinite(pos) || pos < 15) return;

    var map = getProgressMap();
    var key = progressKey(item, kind);

    if (isFinite(dur) && dur > 0 && pos > dur - 60) {
      delete map[key];
    } else {
      map[key] = {
        pos: Math.floor(pos),
        dur: Math.floor(dur || 0),
        at: Date.now()
      };
    }

    setProgressMap(map);
  }
  function getProgress(item, kind) {
    var rec = getProgressMap()[progressKey(item, kind)];
    return rec && rec.pos > 15 ? rec.pos : 0;
  }


  /* ---------------- Perfil ---------------- */
  function fmtDate(ts) {
    if (!ts) return "Sem vencimento";
    var n = parseInt(ts, 10);
    if (!isFinite(n) || n <= 0) return "Sem vencimento";
    var d = new Date(n * 1000);
    var p = function (x) { return x < 10 ? "0" + x : "" + x; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function renderProfile() {
    var u = state.userInfo || {};
    var p = state.profile || {};
    var name = p.user || u.username || "—";
    $("#pf-user").textContent = name;
    $("#pf-username").textContent = name;
    $("#pf-avatar").textContent = (name[0] || "E").toUpperCase();
    $("#pf-exp").textContent = fmtDate(u.exp_date);
    var days = "—";
    if (u.exp_date) {
      var diff = Math.ceil((parseInt(u.exp_date, 10) * 1000 - Date.now()) / 86400000);
      days = diff > 0 ? diff + " dia(s)" : "Vencida";
    } else if (u.exp_date === null) {
      days = "Ilimitado";
    }
    $("#pf-days").textContent = days;
    $("#pf-status").textContent = u.status ? String(u.status) : (state.profile ? "Ativa" : "—");
    $("#pf-conn").textContent = (u.active_cons != null ? u.active_cons : "0") + " / " + (u.max_connections != null ? u.max_connections : "—");
    $("#pf-host").textContent = p.host || "—";
  }

  function openProfile() {
    renderProfile();
    setActiveTab("profile");
    show("profile");
  }

  /* ---------------- Grid / categorias ---------------- */
  function addedTs(i) {
    var v = i.added || i.last_modified || 0;
    var n = parseInt(v, 10);
    return isFinite(n) ? n : 0;
  }
  function recentlyAdded(list, max) {
    return list.slice(0).sort(function (a, b) { return addedTs(b) - addedTs(a); }).slice(0, max || 100);
  }

  function openSearch(origin) {
    state.searchOrigin = origin || null;

    /* ERICKTV_SEARCH_SCOPE_V75
     * Pesquisa aberta dentro de uma categoria fica presa
     * ao tipo atual: filmes, séries ou canais.
     * A busca aberta pela Home continua global.
     */
    state.searchKind =
      origin === "grid"
        ? state.gridKind
        : null;

    var input = $("#search-input");
    var results = $("#search-results");
    var title = $("#screen-search .grid-title");

    var label =
      state.searchKind === "movie"
        ? "Filmes"
        : state.searchKind === "series"
          ? "Séries"
          : state.searchKind === "live"
            ? "Canais"
            : "Tudo";

    if (input) {
      input.value = "";
      input.placeholder =
        state.searchKind
          ? "Buscar em " + label.toLowerCase()
          : "Digite o nome do filme, série ou canal";
    }

    if (results) {
      results.innerHTML = "";
    }

    if (title) {
      title.textContent =
        state.searchKind
          ? "Buscar em " + label
          : "Buscar";
    }

    setActiveTab("search");
    show("search");
  }

  /*
   * ERICKTV_CONTINUE_CARD_V73
   *
   * O histórico guarda o EPISÓDIO para reprodução,
   * mas o cartão visual de uma série sempre usa
   * os dados da SÉRIE.
   */
  function continueDisplayItem(item, kind) {

    if (
      !item ||
      kind !== "series"
    ) {

      return item;
    }


    var out;

    try {

      out =
        JSON.parse(
          JSON.stringify(item)
        );

    } catch (e) {

      out =
        item;
    }


    var seriesId =
      out._series_id ||
      out.series_id ||
      null;


    var series =
      null;


    if (
      seriesId
    ) {

      var catalog =
        state.series.items ||
        [];


      for (
        var i = 0;
        i < catalog.length;
        i++
      ) {

        if (
          String(
            catalog[i].series_id
          ) ===
          String(
            seriesId
          )
        ) {

          series =
            catalog[i];

          break;
        }
      }
    }


    var seriesName =
      (
        series &&
        (
          series.name ||
          series.title
        )
      ) ||
      out._series_name ||
      "";


    var seriesCover =
      (
        series
          ? pickImage(series)
          : ""
      ) ||
      out._series_cover ||
      "";


    /*
     * MUITO IMPORTANTE:
     *
     * NÃO alteramos stream_id/id.
     * Eles continuam sendo o episódio.
     */
    if (
      seriesId
    ) {

      out._series_id =
        seriesId;

      out.series_id =
        seriesId;

      out._resumeEpisode =
        true;
    }


    if (
      seriesName
    ) {

      out._series_name =
        seriesName;

      out.name =
        seriesName;

      out.title =
        seriesName;
    }


    if (
      seriesCover
    ) {

      out._series_cover =
        seriesCover;

      out.stream_icon =
        seriesCover;

      out.cover =
        seriesCover;

      out.series_cover =
        seriesCover;

      out.movie_image =
        seriesCover;
    }


    return out;
  }


  function openGrid(kind, startCat) {
    state.gridKind = kind;
    var data = state[kind === "movie" ? "movies" : kind === "series" ? "series" : "live"];
    var catBox = $("#cat-list");
    catBox.innerHTML = "";

    /* Botão Pesquisar no topo da lateral */
    var sb = document.createElement("button");
    sb.className = "cat cat-search focusable";
    sb.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span class="cat-name">Pesquisar</span>';
    sb.addEventListener("click", function () { openSearch("grid"); });
    catBox.appendChild(sb);

    var cats = [];
    if (kind !== "live") {
      var cont =
        getContinue()
          .filter(
            function (i) {
              return (
                i._kind === kind
              );
            }
          )
          .map(
            function (i) {
              return continueDisplayItem(
                i,
                kind
              );
            }
          );
      cats.push({ category_id: "__cont", category_name: "Continuar assistindo", _items: cont });
      cats.push({ category_id: "__recent", category_name: "Recentes adicionados", _items: recentlyAdded(data.items, 100) });
    }
    cats.push({ category_id: "__all", category_name: "Todos", _items: data.items });
    data.cats.forEach(function (c) {
      cats.push({ category_id: c.category_id, category_name: c.category_name, _items: byCategory(data.items, c.category_id) });
    });

    var defaultBtn = null, defaultCat = null;
    cats.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "cat focusable";
      var n = document.createElement("span"); n.className = "cat-name"; n.textContent = c.category_name;
      var k = document.createElement("span"); k.className = "cat-count"; k.textContent = c._items.length;
      b.appendChild(n); b.appendChild(k);
      b.addEventListener("click", function () { selectCat(kind, c, b); });
      catBox.appendChild(b);
      var wanted = startCat || (kind === "live" ? "__all" : "__recent");
      if (String(c.category_id) === wanted) { defaultBtn = b; defaultCat = c; }
    });
    catBox.scrollTop = 0;
    /* Sempre abre em "Recentes adicionados" (ou "Todos" na TV ao vivo),
       a não ser que uma categoria específica tenha sido pedida. */
    selectCat(kind, defaultCat, defaultBtn);
    state.lastFocus.grid = defaultBtn;
    show("grid");
    if (startCat) {
      /*
       * Ao voltar do player, abre a categoria solicitada,
       * mas mantém o cursor NA CATEGORIA.
       *
       * Só a seta DIREITA entra nos conteúdos.
       */
      setTimeout(function () {
        catBox.scrollTop = 0;

        if (defaultBtn) {
          defaultBtn.classList.add("active");
          state.lastFocus.grid = defaultBtn;
          setFocus(defaultBtn);
        }
      }, 60);
    }
  }

  function selectCat(kind, cat, btn) {
    $$("#cat-list .cat").forEach(function (b) { b.classList.remove("active"); });
    if (btn) btn.classList.add("active");
    $("#grid-title").textContent = cat.category_name;
    var data = state[kind === "movie" ? "movies" : kind === "series" ? "series" : "live"];
    var items = cat._items || (String(cat.category_id) === "__all" ? data.items : byCategory(data.items, cat.category_id));
    var k = String(cat.category_id) === "__cont" ? "resume" : kind;
    /* Categoria completa: todos os itens, carregados aos poucos ao rolar. */
    renderGrid($("#grid-items"), items, k);
  }

  /* Renderização progressiva: mostra TODOS os itens da categoria,
     mas em blocos, para a TV não travar com listas de milhares. */
  var GRID_CHUNK = 90;
  var gridPending = null;

  function renderGrid(box, items, kind) {
    box.innerHTML = "";
    box.scrollTop = 0;
    gridPending = null;
    if (!items || !items.length) {
      box.innerHTML = '<div class="ph" style="padding:40px;color:#a1a1aa">Nenhum conteúdo nesta categoria.</div>';
      return;
    }
    gridPending = { box: box, items: items, kind: kind, next: 0 };
    appendGridChunk();
    appendGridChunk();
  }

  function appendGridChunk() {
    var g = gridPending;
    if (!g || g.next >= g.items.length) return;
    var end = Math.min(g.next + GRID_CHUNK, g.items.length);
    var frag = document.createDocumentFragment();
    for (var i = g.next; i < end; i++) {
      frag.appendChild(makeCard(g.items[i], g.kind, g.kind !== "live"));
    }
    g.box.appendChild(frag);
    g.next = end;
  }

  function maybeLoadMoreGrid(box) {
    if (!gridPending || gridPending.box !== box) return;
    if (box.scrollTop + box.clientHeight > box.scrollHeight - 900) appendGridChunk();
  }

  /* ---------------- Busca ---------------- */
  function runSearch(q) {
    q = (q || "").trim().toLowerCase();
    var box = $("#search-results");

    if (q.length < 2) {
      box.innerHTML = "";
      return;
    }

    var match = function (list) {
      return list.filter(function (i) {
        return (i.name || i.title || "")
          .toLowerCase()
          .indexOf(q) !== -1;
      }).slice(0, 60);
    };

    box.innerHTML = "";

    /* Busca contextual:
     * movie  -> somente filmes
     * series -> somente séries
     * live   -> somente canais
     * null   -> busca global da Home
     */
    if (state.searchKind === "movie") {
      match(state.movies.items).forEach(function (i) {
        box.appendChild(makeCard(i, "movie", true));
      });
      return;
    }

    if (state.searchKind === "series") {
      match(state.series.items).forEach(function (i) {
        box.appendChild(makeCard(i, "series", true));
      });
      return;
    }

    if (state.searchKind === "live") {
      match(state.live.items).forEach(function (i) {
        box.appendChild(makeCard(i, "live", false));
      });
      return;
    }

    match(state.movies.items).forEach(function (i) {
      box.appendChild(makeCard(i, "movie", true));
    });

    match(state.series.items).forEach(function (i) {
      box.appendChild(makeCard(i, "series", true));
    });

    match(state.live.items).forEach(function (i) {
      box.appendChild(makeCard(i, "live", false));
    });
  }

  /* ---------------- Detalhe ---------------- */
  /* ERICKTV_RESUME_SERIES_V72 */
  function resumeSeriesContinue(item) {
    var seriesId = item._series_id || item.series_id || null;
    var episodeId = String(item.stream_id || item.id || "");
    var seriesItem = null;
    var list = state.series.items || [];

    if (seriesId) {
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].series_id) === String(seriesId)) {
          seriesItem = list[i];
          break;
        }
      }
    }

    if (!seriesItem) {
      seriesItem = {
        series_id: seriesId,
        name: item._series_name || item.name || item.title || "Série",
        cover: item._series_cover || pickImage(item),
        stream_icon: item._series_cover || pickImage(item)
      };
    }

    state.detail = {
      item: seriesItem,
      kind: "series"
    };

    function fallback() {
      var playable;
      try {
        playable = JSON.parse(JSON.stringify(item));
      } catch (e) {
        playable = item;
      }

      playable.name =
        item._episode_play_name ||
        item._episode_title ||
        item.name ||
        "Episódio";

      play(playable, "series");
    }

    if (!seriesId) {
      fallback();
      return;
    }

    api("get_series_info", { series_id: seriesId })
      .then(function (info) {
        state.seriesInfo = info;
        var seasons = (info && info.episodes) || {};
        var seasonKeys = Object.keys(seasons);
        var found = false;

        for (var s = 0; s < seasonKeys.length && !found; s++) {
          var seasonKey = seasonKeys[s];
          var eps = seasons[seasonKey] || [];

          for (var e = 0; e < eps.length; e++) {
            var id = String(eps[e].id || eps[e].stream_id || "");

            if (id === episodeId) {
              state.season = seasonKey;
              state.episodes = eps;
              state.epIndex = e;
              found = true;
              break;
            }
          }
        }

        if (found) playEpisode(state.epIndex);
        else fallback();
      })
      .catch(function () {
        fallback();
      });
  }

  function openItem(item, kind) {
    if (kind === "resume") {
      var resumeKind = item._kind || "movie";

      if (resumeKind === "series" && item._resumeEpisode) {
        resumeSeriesContinue(item);
        return;
      }

      /* Compatibilidade com histórico antigo de episódio. */
      if (resumeKind === "series" && !item.series_id) {
        play(item, "series");
        return;
      }

      kind = resumeKind;
    }

    /* De onde este conteúdo foi aberto AGORA. */
    if (state.screen !== "detail" && state.screen !== "player") {
      state.detailOrigin = state.screen;
    }

    if (kind === "live") {
      play(item, "live");
      return;
    }

    if (kind === "series") {
      openSeries(item);
      return;
    }

    openMovie(item);
  }

  function openMovie(item) {
    state.detail = { item: item, kind: "movie" };
    $("#dt-title").textContent = esc(item.name || item.title);
    $("#dt-meta").textContent = [item.rating ? "★ " + item.rating : "", item.year || "", "Filme"].filter(Boolean).join("  ·  ");
    $("#dt-desc").textContent = esc(item.plot || "");
    var img = pickImage(item);
    $("#dt-img").src = img || "";
    $("#dt-seasons").innerHTML = "";
    (function(){var t=$("#dt-ep-track");if(t){t.innerHTML="";t.dataset.x=0;t.style.transform="translateX(0px)";}else{$("#dt-episodes").innerHTML="";}})();
    show("detail");
    api("get_vod_info", { vod_id: item.stream_id }).then(function (info) {
      if (info && info.info) {
        $("#dt-desc").textContent = esc(info.info.plot || info.info.description || "");
        var m = [];
        if (info.info.rating) m.push("★ " + info.info.rating);
        if (info.info.releasedate) m.push(info.info.releasedate);
        if (info.info.duration) m.push(info.info.duration);
        if (info.info.genre) m.push(info.info.genre);
        if (m.length) $("#dt-meta").textContent = m.join("  ·  ");
        if (info.movie_data && info.movie_data.container_extension) {
          item.container_extension = info.movie_data.container_extension;
        }
        if (info.info.backdrop_path && info.info.backdrop_path.length) $("#dt-img").src = info.info.backdrop_path[0];
      }
    }).catch(function () {});
  }

  function openSeries(item) {
    state.detail = { item: item, kind: "series" };
    $("#dt-title").textContent = esc(item.name || item.title);
    $("#dt-meta").textContent = [item.rating ? "★ " + item.rating : "", item.releaseDate || "", "Série"].filter(Boolean).join("  ·  ");
    $("#dt-desc").textContent = esc(item.plot || "");
    $("#dt-img").src = item.backdrop_path && item.backdrop_path[0] ? item.backdrop_path[0] : pickImage(item);
    $("#dt-seasons").innerHTML = '<span style="color:#a1a1aa">Carregando temporadas…</span>';
    (function(){var t=$("#dt-ep-track");if(t){t.innerHTML="";t.dataset.x=0;t.style.transform="translateX(0px)";}else{$("#dt-episodes").innerHTML="";}})();
    show("detail");

    api("get_series_info", { series_id: item.series_id }).then(function (info) {
      state.seriesInfo = info;
      if (info && info.info) {
        $("#dt-desc").textContent = esc(info.info.plot || "");
        if (info.info.backdrop_path && info.info.backdrop_path[0]) $("#dt-img").src = info.info.backdrop_path[0];
      }
      var eps = (info && info.episodes) || {};
      var keys = Object.keys(eps).sort(function (a, b) { return Number(a) - Number(b); });
      var box = $("#dt-seasons");
      box.innerHTML = "";
      if (!keys.length) { box.innerHTML = '<span style="color:#a1a1aa">Nenhum episódio disponível.</span>'; return; }
      keys.forEach(function (k) {
        var b = document.createElement("button");
        b.className = "season focusable";
        b.textContent = "Temporada " + k;
        b.addEventListener("click", function () { selectSeason(k, b); });
        box.appendChild(b);
      });
      selectSeason(keys[0], box.firstChild);
    }).catch(function (e) {
      $("#dt-seasons").innerHTML = '<span style="color:#ff8a8a">Erro ao carregar episódios.</span>';
    });
  }

  function selectSeason(k, btn) {
    $$("#dt-seasons .season").forEach(function (b) { b.classList.remove("active"); });
    if (btn) btn.classList.add("active");
    state.season = k;
    var eps = (state.seriesInfo && state.seriesInfo.episodes && state.seriesInfo.episodes[k]) || [];
    var box = $("#dt-ep-track") || $("#dt-episodes");
    box.innerHTML = "";
    box.dataset.x = 0;
    box.style.transform = "translateX(0px)";
    state.episodes = eps;
    eps.forEach(function (ep, idx) {
      var b = document.createElement("button");
      b.className = "ep focusable";
      var info = ep.info || {};
      b.innerHTML = "<b></b><small></small>";
      b.querySelector("b").textContent = "E" + ep.episode_num + " · " + esc(ep.title || "Episódio " + ep.episode_num);
      b.querySelector("small").textContent = esc(info.duration || info.plot || "");
      b.addEventListener("click", function () { playEpisode(idx); });
      box.appendChild(b);
    });
  }

  function episodeItem(ep) {
    var series = state.detail && state.detail.item ? state.detail.item : null;
    var seriesName = series ? (series.name || series.title || "") : "";
    var seriesCover = series ? pickImage(series) : "";
    var epId = ep.id || ep.stream_id;
    var epNum = ep.episode_num != null ? ep.episode_num : "";
    var epTitle = ep.title || (epNum !== "" ? "Episódio " + epNum : "Episódio");

    return {
      stream_id: epId,
      id: epId,
      container_extension:
        ep.container_extension ||
        (ep.info && ep.info.container_extension) ||
        "mp4",

      /* Nome mostrado no player. */
      name:
        seriesName +
        (seriesName ? " · " : "") +
        (epNum !== "" ? "E" + epNum + " · " : "") +
        epTitle,

      /* Metadados usados pelo Continuar assistindo. */
      _series_id: series ? series.series_id : null,
      series_id: series ? series.series_id : null,
      _series_name: seriesName,
      _series_cover: seriesCover,
      _season: state.season != null ? String(state.season) : "",
      _episode_num: epNum,
      _episode_title: epTitle
    };
  }

  function playEpisode(idx) {
    var eps = state.episodes || [];
    if (!eps[idx]) return;
    state.epIndex = idx;
    play(episodeItem(eps[idx]), "series");
  }

  function nextEpisode() {
    var eps = state.episodes || [];
    var idx = (state.epIndex == null ? -1 : state.epIndex) + 1;
    if (!eps[idx]) { toast("Este é o último episódio da temporada."); return; }
    toast("Próximo episódio…");
    playEpisode(idx);
  }

  /* ---------------- Player ---------------- */
  var video = null, osdTimer = null;

  /* Botões do OSD navegáveis com ▲ ▼ */
  var osdSel = -1;

  function osdButtons() {
    return $$("#player-osd .osd-btn").filter(function (b) {
      return !b.classList.contains("hidden");
    });
  }

  function renderOsdSel() {
    var list = osdButtons();
    list.forEach(function (b, i) { b.classList.toggle("sel", i === osdSel); });
  }

  function moveOsdSel(dir) {
    var list = osdButtons();
    if (!list.length) return;
    if (dir === "down") { if (osdSel < 0) osdSel = 0; }
    else if (dir === "up") { osdSel = -1; }
    else if (dir === "right") { osdSel = Math.min(osdSel + 1, list.length - 1); }
    else if (dir === "left") { osdSel = Math.max(osdSel - 1, 0); }
    renderOsdSel();
    showOsd();
  }

  function showOsd() {
    $("#player-osd").classList.add("show");
    clearTimeout(osdTimer);
    osdTimer = setTimeout(function () {
      $("#player-osd").classList.remove("show");
      osdSel = -1;
      renderOsdSel();
    }, 5000);
  }

  /* Ajuste de imagem */
  var ASPECTS = [
    { fit: "contain", cls: "fit-contain", label: "Original" },
    { fit: "cover", cls: "fit-cover", label: "Preencher tela" },
    { fit: "fill", cls: "fit-fill", label: "Esticado" },
    { fit: "contain", cls: "fit-zoom", label: "Zoom" }
  ];
  var aspectIdx = 0;

  function applyAspect() {
    if (!video) return;
    var a = ASPECTS[aspectIdx] || ASPECTS[0];
    ASPECTS.forEach(function (x) { video.classList.remove(x.cls); });
    video.classList.add(a.cls);
    video.style.objectFit = a.fit;
    video.style.transform = a.cls === "fit-zoom" ? "scale(1.18)" : "";
  }

  function cycleAspect() {
    aspectIdx = (aspectIdx + 1) % ASPECTS.length;
    applyAspect();
    try { LS.setItem("stv_aspect", String(aspectIdx)); } catch (e) {}
    toast("Imagem: " + ASPECTS[aspectIdx].label);
    showOsd();
  }

  function destroyPlayer() {
    if (state.hls) { try { state.hls.destroy(); } catch (e) {} state.hls = null; }
    if (video) { try { video.pause(); } catch (e) {} video.removeAttribute("src"); try { video.load(); } catch (e) {} }
  }

  function persistPosition() {
    if (!state.playing || !video) return;
    if (state.playing.kind === "live") return;
    if (state._changingMedia) return;

    var pos = video.currentTime;
    var dur = video.duration;

    saveProgress(
      state.playing.item,
      state.playing.kind,
      pos,
      dur
    );

    var finished =
      isFinite(dur) &&
      dur > 0 &&
      pos > dur - 60;

    if (finished) {
      removeContinue(
        state.playing.item,
        state.playing.kind
      );
      return;
    }

    /* Salva durante a reprodução, mesmo sem apertar Voltar. */
    if (isFinite(pos) && pos >= 15) {
      var now = Date.now();

      if (
        !state._continueSavedAt ||
        now - state._continueSavedAt >= 15000
      ) {
        state._continueSavedAt = now;
        saveContinue(
          state.playing.item,
          state.playing.kind,
          pos
        );
      }
    }
  }

  function play(item, kind) {
    var url = streamUrl(kind === "movie" ? "movie" : kind === "series" ? "series" : "live", item);

    /*
     * Guarda exatamente de onde ESTE player foi aberto.
     * Não reutiliza detalhe antigo.
     */
    if (state.screen !== "player") {
      state.playerOrigin = {
        screen: state.screen,
        detail: state.detail || null
      };
    }

    state._changingMedia = true;
    destroyPlayer();
    state._changingMedia = false;

    state.playing = { item: item, kind: kind, url: url };
    state._continueSavedAt = 0;
    state.resumeAt = kind === "live" ? 0 : getProgress(item, kind);
    show("player");
    $("#osd-title").textContent = esc(item.name || item.title || "Reproduzindo");
    $("#player-error").classList.remove("show");
    $("#player-spinner").classList.add("show");
    osdSel = -1;
    $("#osd-next-ep").classList.toggle("hidden", kind !== "series");
    renderOsdSel();
    showOsd();
    applyAspect();

    var isHls = /\.m3u8(\?|$)/i.test(url);
    var canNative = video.canPlayType("application/vnd.apple.mpegurl") !== "" ||
      video.canPlayType("application/x-mpegURL") !== "";

    if (isHls && !canNative && window.Hls && window.Hls.isSupported()) {
      var hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        manifestLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6
      });
      state.hls = hls;
      hls.on(window.Hls.Events.ERROR, function (evt, data) {
        if (!data.fatal) return;
        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else playError("Não foi possível reproduzir este conteúdo.");
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.MANIFEST_PARSED, function () { video.play().catch(function () {}); });
    } else {
      video.src = url;
      video.play().catch(function () {});
    }

    /*
     * Retoma de onde parou (filmes e episódios).
     */
    if (state.resumeAt > 0) {
      var target = state.resumeAt;
      var done = false;

      var cleanup = function () {
        video.removeEventListener("loadedmetadata", doResume);
        video.removeEventListener("canplay", doResume);
      };

      var doResume = function () {
        if (done) return;
        if (!isFinite(video.duration) || video.duration <= 0) return;
        done = true;
        cleanup();
        if (target >= video.duration - 20) return;
        try { video.currentTime = target; } catch (e) { return; }
        toast("Retomando de " + fmtTime(target));
        showOsd();
      };

      video.addEventListener("loadedmetadata", doResume);
      video.addEventListener("canplay", doResume);
      if (video.readyState >= 1) doResume();
    }
  }

  function playError(msg) {
    $("#player-spinner").classList.remove("show");
    var el = $("#player-error");
    el.textContent = msg + " Pressione VOLTAR para retornar.";
    el.classList.add("show");
  }

  function togglePlay() {
    if (!video) return;
    if (video.paused) video.play().catch(function () {}); else video.pause();
    showOsd();
  }

  function seek(delta) {
    if (!video || !isFinite(video.duration) || video.duration <= 0) return;

    seekToTime(video.currentTime + delta);
  }

  /*
   * Vai diretamente para uma posição específica.
   * Exemplo:
   * seekToTime(3600) -> 01:00:00
   */
  function seekToTime(seconds) {
    if (!video) return;

    if (
      !isFinite(seconds) ||
      !isFinite(video.duration) ||
      video.duration <= 0
    ) {
      return;
    }

    var target = Math.max(
      0,
      Math.min(video.duration - 0.1, seconds)
    );

    function applySeek() {
      try {
        video.currentTime = target;

        /*
         * Continua reproduzindo dali.
         */
        video.play().catch(function () {});

        $("#osd-cur").textContent =
          fmtTime(target);

        $("#osd-progress").style.width =
          ((target / video.duration) * 100) + "%";

        showOsd();
      } catch (e) {}
    }

    /*
     * Se a mídia já carregou metadata, pode buscar agora.
     */
    if (video.readyState >= 1) {
      applySeek();
      return;
    }

    /*
     * TVs webOS mais antigas podem precisar esperar
     * o carregamento antes de alterar currentTime.
     */
    video.addEventListener(
      "loadedmetadata",
      function onMeta() {
        video.removeEventListener(
          "loadedmetadata",
          onMeta
        );

        applySeek();
      }
    );
  }

  function exitPlayer() {
    persistPosition();

    var wasKind = state.playing ? state.playing.kind : null;
    var pos = video ? video.currentTime : 0;
    var dur = video ? video.duration : 0;

    var finished = !!(
      video &&
      isFinite(dur) &&
      dur > 0 &&
      pos > dur - 60
    );

    var hadProgress = !!(
      state.playing &&
      wasKind !== "live" &&
      video &&
      pos > 15 &&
      !finished
    );

    if (hadProgress) {
      saveContinue(
        state.playing.item,
        wasKind,
        pos
      );
    }

    var origin = state.playerOrigin;

    state._changingMedia = true;
    destroyPlayer();
    state._changingMedia = false;

    if (hadProgress && (wasKind === "movie" || wasKind === "series")) {
      /* Parou no meio: volta para Continuar assistindo da própria categoria. */
      state.playerOrigin = null;
      state.playing = null;
      state.detail = null;
      state.detailOrigin = null;
      state.prevGrid = "grid";
      openGrid(wasKind, "__cont");
      return;
    }

    state.playerOrigin = null;
    state.playing = null;

    if (origin && origin.screen === "detail" && origin.detail) {
      state.detail = origin.detail;
      show("detail");
      return;
    }

    if (origin && origin.screen) {
      if (origin.screen === "grid") {
        state.detail = null;
        show("grid");
        return;
      }

      if (origin.screen === "search") {
        state.detail = null;
        show("search");
        return;
      }

      if (origin.screen === "home") {
        state.detail = null;
        goMenu();
        return;
      }
    }

    state.detail = null;
    goMenu();
  }
  /* ---------------- Listas (várias contas Xtream) ---------------- */
  function loadLists() {
    try { return JSON.parse(LS.getItem("stv_lists") || "[]") || []; } catch (e) { return []; }
  }
  function saveLists(arr) { try { LS.setItem("stv_lists", JSON.stringify(arr)); } catch (e) {} }
  function sameList(a, b) { return a && b && a.host === b.host && a.user === b.user; }
  function upsertList(p) {
    var arr = loadLists().filter(function (x) { return !sameList(x, p); });
    arr.unshift({ host: p.host, user: p.user, pass: p.pass });
    saveLists(arr.slice(0, 20));
  }
  function hostLabel(h) { return String(h || "").replace(/^https?:\/\//, ""); }
  function renderLists() {
    var box = $("#lists-items");
    box.innerHTML = "";
    var arr = loadLists();
    if (state.profile && !arr.some(function (x) { return sameList(x, state.profile); })) {
      upsertList(state.profile); arr = loadLists();
    }
    arr.forEach(function (p) {
      var isActive = sameList(p, state.profile);
      var c = document.createElement("div");
      c.className = "list-card focusable" + (isActive ? " active" : "");
      c.innerHTML = '<div class="lc-name"></div><div class="lc-host"></div>' +
        '<div class="lc-tag">' + (isActive ? "Lista em uso" : "Toque para entrar") + '</div>';
      $(".lc-name", c).textContent = p.user;
      $(".lc-host", c).textContent = hostLabel(p.host);
      var rm = document.createElement("button");
      rm.type = "button"; rm.className = "list-remove focusable"; rm.textContent = "Remover";
      rm.addEventListener("click", function (ev) {
        ev.stopPropagation();
        saveLists(loadLists().filter(function (x) { return !sameList(x, p); }));
        if (isActive) { logout(); return; }
        renderLists(); toast("Lista removida.");
      });
      c.appendChild(rm);
      c.addEventListener("click", function () {
        if (isActive) { goMenu(); return; }
        try { LS.removeItem(CATALOG_CACHE_KEY); } catch (e) {}
        /* O histórico é separado por conta; trocar lista não apaga. */
        state.lastFocus = {};
        toast("Entrando em " + p.user + "…");
        $("#in-host").value = p.host; $("#in-user").value = p.user; $("#in-pass").value = p.pass;
        doLogin(p, true).then(function () { goMenu(); }).catch(function () {});
      });
      box.appendChild(c);
    });
  }
  function openLists() { renderLists(); show("lists"); }

  /* ---------------- Sair ---------------- */
  function logout() {
    try { LS.removeItem("stv_profile"); } catch (e) {}
    try { LS.removeItem(CATALOG_CACHE_KEY); } catch (e) {}
    /* Logout não apaga o histórico da conta. */
    state.userInfo = null;
    destroyPlayer();
    state.profile = null;
    state.playing = null;
    state.detail = null;
    state.detailOrigin = null;
    state.playerOrigin = null;
    state.lastFocus = {};
    $("#login-msg").textContent = "";
    $("#in-pass").value = "";
    goMenu();
  }

  /* ---------------- Controle remoto ---------------- */
  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
    BACK: 461, ESC: 27, BACKSPACE: 8,
    PLAY: 415, PAUSE: 19, STOP: 413, FF: 417, RW: 412, PLAYPAUSE: 179
  };

  function onKey(e) {
    var k = e.keyCode;
    var typing = document.activeElement && document.activeElement.tagName === "INPUT";

    if (state.accessLocked) {
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      return;
    }

    if (state.screen === "player") {
      e.preventDefault();
      if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE || k === KEY.STOP) return exitPlayer();
      if (k === KEY.UP || k === KEY.DOWN) return moveOsdSel(k === KEY.DOWN ? "down" : "up");
      var osdOpen = $("#player-osd").classList.contains("show");
      if (k === KEY.ENTER || k === KEY.PLAY || k === KEY.PAUSE || k === KEY.PLAYPAUSE) {
        var sel = osdButtons()[osdSel];
        if (sel && osdOpen) { sel.click(); return; }
        return togglePlay();
      }
      /* Com um botão selecionado, ◀ ▶ trocam de botão; senão avançam/voltam 10s. */
      if ((k === KEY.RIGHT || k === KEY.LEFT) && osdOpen && osdSel >= 0) {
        return moveOsdSel(k === KEY.RIGHT ? "right" : "left");
      }
      if (k === KEY.RIGHT || k === KEY.FF) return seek(10);
      if (k === KEY.LEFT || k === KEY.RW) return seek(-10);
      return;
    }

    if (k === KEY.BACK || k === KEY.ESC || (k === KEY.BACKSPACE && !typing)) {
      e.preventDefault();
      return goBack();
    }

    if (k === KEY.ENTER) {
      if (typing && state.screen === "search") { runSearch(document.activeElement.value); return; }
      if (typing && state.screen === "login" && current && current.tagName === "INPUT") { move("down"); return; }
      e.preventDefault();
      if (current) current.click();
      return;
    }

    if (k === KEY.LEFT || k === KEY.RIGHT) {
      if (typing) return; // deixa mover o cursor dentro do campo
      e.preventDefault();
      move(k === KEY.LEFT ? "left" : "right");
      return;
    }

    if (k === KEY.UP || k === KEY.DOWN) {
      e.preventDefault();
      move(k === KEY.UP ? "up" : "down");
      return;
    }
  }

  function goBack() {
    if (state.screen === "menu") {
      if (window.AndroidTV && window.AndroidTV.exit) window.AndroidTV.exit();
      else if (window.webOS && window.webOS.platformBack) window.webOS.platformBack();
      else if (window.close) window.close();
      return;
    }
    if (state.screen === "login") {
      state.addingList = false;
      $("#login-msg").textContent = "";
      goMenu();
      return;
    }

    if (state.screen === "detail") {
      /*
       * Volta apenas para a tela de onde este detalhe foi aberto agora.
       */
      var origin = state.detailOrigin;
      state.detailOrigin = null;
      state.detail = null;
      if (origin === "grid" || origin === "search") { show(origin); return; }
      goMenu();
      return;
    }

    if (state.screen === "search" && state.searchOrigin === "grid") {
      state.searchOrigin = null;
      show("grid");
      return;
    }

    state.detail = null;
    state.detailOrigin = null;
    goMenu();
  }

  function bindMenu() {
    $$("#screen-menu .tile").forEach(function (t) {
      t.addEventListener("click", function () {
        var go = t.dataset.go;

        if (go === "highlights") {
          openLists();
          return;
        }

        if (!state.profile) {
          toast("Adicione uma lista em Listas.");
          return;
        }

        state.prevGrid = "grid";
        openGrid(go);
      });
    });
    var mtMap = { "#mt-search": function () { openSearch("menu"); },
                  "#mt-profile": openProfile,
                  "#mt-refresh": function () { refreshCatalog(); },
                  "#mt-logout": function () { logout(); } };
    Object.keys(mtMap).forEach(function (sel) {
      var b = $(sel);
      if (b) b.addEventListener("click", mtMap[sel]);
    });
  }

  function setActiveTab(name) {
    $$(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
  }

  /* ---------------- Bind ---------------- */
  function init() {
    initAccessGate();
    video = $("#video");
    /* Histórico persistente: não limpar ao iniciar. */

    video.addEventListener("playing", function () { $("#player-spinner").classList.remove("show"); applyAspect(); });
    video.addEventListener("loadedmetadata", applyAspect);
    video.addEventListener("waiting", function () { $("#player-spinner").classList.add("show"); });
    video.addEventListener("error", function () { playError("Erro ao carregar o stream."); });
    /*
     * Magic Remote / mouse:
     * clicar na barra pula diretamente para aquele ponto.
     */
    var progressBar =
      $("#osd-progress").parentNode;

    if (progressBar) {
      progressBar.addEventListener(
        "click",
        function (event) {
          if (
            !video ||
            !isFinite(video.duration) ||
            video.duration <= 0
          ) {
            return;
          }

          var rect =
            progressBar.getBoundingClientRect();

          if (!rect.width) return;

          var pct =
            (event.clientX - rect.left) /
            rect.width;

          pct = Math.max(
            0,
            Math.min(1, pct)
          );

          seekToTime(
            video.duration * pct
          );
        }
      );
    }

    var lastSaved = 0;
    video.addEventListener("timeupdate", function () {
      $("#osd-cur").textContent = fmtTime(video.currentTime);
      $("#osd-dur").textContent = isFinite(video.duration) ? fmtTime(video.duration) : "AO VIVO";
      var pct = isFinite(video.duration) && video.duration > 0 ? (video.currentTime / video.duration) * 100 : 100;
      $("#osd-progress").style.width = pct + "%";
      /* Salva a posição a cada 5s, para retomar depois. */
      if (Math.abs(video.currentTime - lastSaved) > 5) {
        lastSaved = video.currentTime;
        persistPosition();
      }
    });
    video.addEventListener("pause", persistPosition);
    video.addEventListener("ended", function () {
      persistPosition();
      if (state.playing && state.playing.kind === "series" && (state.episodes || [])[(state.epIndex || 0) + 1]) {
        nextEpisode();
      }
    });

    /* Restaura o modo de imagem escolhido */
    var savedAspect = parseInt(LS.getItem("stv_aspect") || "0", 10);
    if (savedAspect >= 0 && savedAspect < ASPECTS.length) aspectIdx = savedAspect;
    applyAspect();

    $("#osd-next-ep").addEventListener("click", nextEpisode);
    $("#osd-aspect").addEventListener("click", cycleAspect);

    var refreshButton = $("#btn-refresh");
    if (refreshButton) {
      refreshButton.addEventListener("click", function () { refreshCatalog(); });
    }

    var logoutButton = $("#btn-logout");
    if (logoutButton) {
      logoutButton.addEventListener("click", function () { logout(); });
    }

    bindMenu();
    var listsAdd = $("#lists-add");
    if (listsAdd) {
      listsAdd.addEventListener("click", function () {
        $("#in-host").value = ""; $("#in-user").value = ""; $("#in-pass").value = "";
        $("#login-msg").textContent = "Adicione uma nova lista Xtream.";
        state.addingList = true;
        show("login");
      });
    }
    var pfClear = $("#pf-clear");
    if (pfClear) {
      pfClear.addEventListener("click", function () {
        clearHistory();
        buildHome();
        buildMenu();
        toast("Histórico apagado.");
      });
    }
    var pfLogout = $("#pf-logout");
    if (pfLogout) {
      pfLogout.addEventListener("click", function () { logout(); });
    }
    var gridBox = $("#grid-items");
    if (gridBox) {
      gridBox.addEventListener("scroll", function () { maybeLoadMoreGrid(gridBox); });
    }

    $("#btn-login").addEventListener("click", function () {
      var p = {
        host: normHost($("#in-host").value),
        user: $("#in-user").value.trim(),
        pass: $("#in-pass").value.trim()
      };
      if (!p.host || !p.user || !p.pass) { $("#login-msg").textContent = "Preencha todos os campos."; return; }
      doLogin(p).catch(function () {});
    });

    $$(".tab").forEach(function (t) {
      t.addEventListener("click", function () {
        var tab = t.dataset.tab;
        setActiveTab(tab);
        if (tab === "home") show("home");
        else if (tab === "profile") { openProfile(); }
        else if (tab === "search") { show("search"); }
        else { state.prevGrid = "grid"; openGrid(tab === "live" ? "live" : tab === "movies" ? "movie" : "series"); }
      });
    });

    $("#bb-play").addEventListener("click", function () {
      if (state.hero) openItem(state.hero, state.heroKind);
    });
    $("#bb-info-btn").addEventListener("click", function () {
      if (state.hero) openItem(state.hero, state.heroKind === "live" ? "live" : state.heroKind);
    });
    $("#dt-play").addEventListener("click", function () {
      if (!state.detail) return;
      if (state.detail.kind === "movie") play(state.detail.item, "movie");
      else {
        var ep = $("#dt-episodes .ep");
        if (ep) ep.click(); else toast("Nenhum episódio disponível");
      }
    });

    var si = $("#search-input");
    var st;
    si.addEventListener("input", function () {
      clearTimeout(st);
      st = setTimeout(function () { runSearch(si.value); }, 350);
    });

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousemove", function () {}, false);

    // Sessão salva
    var saved = null;

    try {
      saved = JSON.parse(
        LS.getItem("stv_profile") || "null"
      );
    } catch (e) {}

    if (
      saved &&
      saved.host &&
      saved.user &&
      saved.pass
    ) {

      /*
       * Login já realizado anteriormente.
       *
       * NÃO mostramos a tela de login novamente.
       */
      state.profile = saved;

      $("#in-host").value = saved.host;
      $("#in-user").value = saved.user;
      $("#in-pass").value = saved.pass;

      $("#user-name").textContent = saved.user;

      /*
       * Primeiro tenta abrir imediatamente usando
       * o catálogo salvo da última sessão.
       */
      if (restoreCatalogCache()) {
        buildHome();
        goMenu();
      } else {

        /*
         * Primeira abertura após esta atualização:
         * ainda não existe cache.
         *
         * Mostra Home enquanto busca catálogo,
         * sem voltar para o formulário de login.
         */
        goMenu();

        $("#bb-title").textContent =
          "Carregando catálogo…";

        $("#bb-desc").textContent =
          "Preparando filmes, séries e canais.";
      }

      /*
       * Valida a conta e busca conteúdo novo
       * silenciosamente.
       */
      doLogin(saved, true)
        .catch(function () {
          /*
           * doLogin já volta ao login se a conta
           * realmente não puder mais ser usada.
           */
        });

      return;
    }

    /*
     * ERICKTV_HOME_FIRST_NO_ACCOUNT_V74
     * Mesmo sem conta, o app começa e permanece no launcher.
     * O formulário Xtream só é aberto pelo card Listas.
     */
    goMenu();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
