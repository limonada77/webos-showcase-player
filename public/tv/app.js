/* =========================================================
   ErickTV — Xtream Codes player para LG webOS
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

  /* ---------------- Estado ---------------- */
  var state = {
    profile: null,           // {host, user, pass}
    screen: "login",
    live: { cats: [], items: [], cat: null },
    movies: { cats: [], items: [], cat: null },
    series: { cats: [], items: [], cat: null },
    gridKind: "live",
    detail: null,
    seriesInfo: null,
    season: null,
    playing: null,
    hls: null,
    lastFocus: {}
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
      $("#user-name").textContent = profile.user;
      renderProfile();
      return loadCatalog();
    }).catch(function (e) {
      state.profile = null;
      $("#login-msg").textContent = "Falha ao conectar: " + e.message +
        " — verifique servidor, usuário e senha (e a conexão da TV).";
      show("login");
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
      show("home");
    });
  }

  function refreshCatalog() {

    if (!state.profile) {
      toast("Conta não conectada.");
      show("login");
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
  function pickImage(it) {
    return it.stream_icon || it.cover || it.movie_image || it.cover_big || "";
  }

  function makeCard(item, kind, poster) {
    var el = document.createElement("div");
    el.className = "card focusable" + (poster ? " poster" : "");
    var img = pickImage(item);
    var name = esc(item.name || item.title);
    if (img) {
      el.innerHTML = '<img loading="lazy" alt="" src="' + img + '"><div class="cap"></div>';
      var im = el.firstChild;
      im.onerror = function () { el.innerHTML = '<div class="ph">' + name + "</div>"; };
      el.querySelector(".cap").textContent = name;
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

  function buildHome() {
    var rows = $("#rows");
    rows.innerHTML = "";
    rows.scrollTop = 0;

    var cont = getContinue();
    var r;
    if (cont.length) { r = makeRow("Continuar assistindo", cont, "resume", false); if (r) rows.appendChild(r); }

    r = makeRow("Filmes em alta", state.movies.items.slice(0, 24), "movie", true);
    if (r) rows.appendChild(r);
    r = makeRow("Séries para maratonar", state.series.items.slice(0, 24), "series", true);
    if (r) rows.appendChild(r);
    r = makeRow("Canais ao vivo", state.live.items.slice(0, 24), "live", false);
    if (r) rows.appendChild(r);

    // 3 categorias de filmes com mais itens
    state.movies.cats.slice(0, 6).forEach(function (c) {
      var items = byCategory(state.movies.items, c.category_id);
      var rr = makeRow(c.category_name, items, "movie", true);
      if (rr && items.length > 3) rows.appendChild(rr);
    });

    // Billboard
    var pool = state.movies.items.filter(function (m) { return pickImage(m); });
    var hero = pool.length ? pool[Math.floor(Math.random() * Math.min(pool.length, 30))] : (state.live.items[0] || null);
    setBillboard(hero);
  }

  function setBillboard(item) {
    if (!item) return;
    state.hero = item;
    $("#bb-title").textContent = esc(item.name || item.title);
    $("#bb-kicker").textContent = item.stream_type === "live" ? "Ao vivo agora" : "Em destaque";
    $("#bb-desc").textContent = esc(item.plot || item.description || "Assista agora em alta qualidade no seu ErickTV.");
    var img = pickImage(item);
    var el = $("#bb-img");
    if (img) { el.src = img; el.style.display = "block"; } else { el.style.display = "none"; }
    state.heroKind = item.series_id ? "series" : (item.stream_type === "live" ? "live" : "movie");
  }

  /* ------------------------------------------------------------
     Histórico APENAS da sessão atual (memória).
     Ao sair/entrar novamente, o histórico começa vazio.
     ------------------------------------------------------------ */
  var sessionHistory = { cont: [], progress: {} };

  function clearHistory() {
    sessionHistory = { cont: [], progress: {} };
    try { LS.removeItem("stv_continue"); } catch (e) {}
    try { LS.removeItem("stv_progress_v1"); } catch (e) {}
  }

  /* ---------------- Continuar assistindo ---------------- */
  function getContinue() {
    return sessionHistory.cont.slice(0);
  }
  function saveContinue(item, kind, pos) {
    if (kind === "live") return;
    var list = getContinue().filter(function (i) { return String(i.stream_id) !== String(item.stream_id); });
    var rec = JSON.parse(JSON.stringify(item));
    rec._kind = kind; rec._pos = pos || 0;
    list.unshift(rec);
    sessionHistory.cont = list.slice(0, 12);
  }

  /* ------- Posição de reprodução (retomar de onde parou) ------- */
  function getProgressMap() {
    return sessionHistory.progress;
  }

  function progressKey(item, kind) {
    return kind + ":" + String(item.stream_id || item.id || item.name || "");
  }

  function saveProgress(item, kind, pos, dur) {
    if (kind === "live" || !item) return;
    if (!isFinite(pos) || pos < 15) return;
    var map = getProgressMap();
    /* Terminou: não guarda posição. */
    if (isFinite(dur) && dur > 0 && pos > dur - 60) {
      delete map[progressKey(item, kind)];
    } else {
      map[progressKey(item, kind)] = { pos: Math.floor(pos), dur: Math.floor(dur || 0), at: Date.now() };
    }
  }

  function getProgress(item, kind) {
    var rec = getProgressMap()[progressKey(item, kind)];
    return rec && rec.pos > 15 ? rec.pos : 0;
  }


  /* ---------------- Grid / categorias ---------------- */
  function openGrid(kind) {
    state.gridKind = kind;
    var data = state[kind === "movie" ? "movies" : kind === "series" ? "series" : "live"];
    $("#grid-title").textContent = kind === "movie" ? "Filmes" : kind === "series" ? "Séries" : "Canais ao vivo";
    var catBox = $("#cat-list");
    catBox.innerHTML = "";
    var cats = [{ category_id: "__all", category_name: "Todos" }].concat(data.cats);
    cats.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "cat focusable";
      b.textContent = c.category_name;
      b.addEventListener("click", function () { selectCat(kind, c, b); });
      catBox.appendChild(b);
    });
    selectCat(kind, cats[0], catBox.firstChild);
    show("grid");
  }

  function selectCat(kind, cat, btn) {
    $$("#cat-list .cat").forEach(function (b) { b.classList.remove("active"); });
    if (btn) btn.classList.add("active");
    var data = state[kind === "movie" ? "movies" : kind === "series" ? "series" : "live"];
    var items = String(cat.category_id) === "__all" ? data.items : byCategory(data.items, cat.category_id);
    /* Categoria completa: todos os itens, carregados aos poucos ao rolar. */
    renderGrid($("#grid-items"), items, kind);
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
    if (q.length < 2) { box.innerHTML = ""; return; }
    var match = function (list) {
      return list.filter(function (i) { return (i.name || i.title || "").toLowerCase().indexOf(q) !== -1; }).slice(0, 60);
    };
    box.innerHTML = "";
    match(state.movies.items).forEach(function (i) { box.appendChild(makeCard(i, "movie", true)); });
    match(state.series.items).forEach(function (i) { box.appendChild(makeCard(i, "series", true)); });
    match(state.live.items).forEach(function (i) { box.appendChild(makeCard(i, "live", false)); });
  }

  /* ---------------- Detalhe ---------------- */
  function openItem(item, kind) {
    if (kind === "resume") { kind = item._kind || "movie"; }
    /* De onde este conteúdo foi aberto AGORA (evita voltar para telas antigas). */
    if (state.screen !== "detail" && state.screen !== "player") state.detailOrigin = state.screen;
    if (kind === "live") { play(item, "live"); return; }
    if (kind === "series") { openSeries(item); return; }
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
    return {
      stream_id: ep.id,
      id: ep.id,
      container_extension: ep.container_extension || "mp4",
      name: ((state.detail && state.detail.item && state.detail.item.name) || "") + " · E" + ep.episode_num
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
    osdSel = dir === "down" ? osdSel + 1 : osdSel - 1;
    if (osdSel < -1) osdSel = list.length - 1;
    if (osdSel > list.length - 1) osdSel = -1;
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
    saveProgress(state.playing.item, state.playing.kind, video.currentTime, video.duration);
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

    state.playing = { item: item, kind: kind, url: url };
    state.resumeAt = kind === "live" ? 0 : getProgress(item, kind);
    show("player");
    $("#osd-title").textContent = esc(item.name || item.title || "Reproduzindo");
    $("#player-error").classList.remove("show");
    $("#player-spinner").classList.add("show");
    osdSel = -1;
    $("#osd-next-ep").classList.toggle("hidden", kind !== "series");
    renderOsdSel();
    showOsd();
    destroyPlayer();
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

    if (
      state.playing &&
      state.playing.kind !== "live" &&
      video &&
      video.currentTime > 30
    ) {
      saveContinue(
        state.playing.item,
        state.playing.kind,
        video.currentTime
      );
    }


    destroyPlayer();

    var origin = state.playerOrigin;

    /*
     * Limpa primeiro para nunca reaproveitar
     * uma origem velha posteriormente.
     */
    state.playerOrigin = null;
    state.playing = null;

    if (origin && origin.screen === "detail" && origin.detail) {
      state.detail = origin.detail;
      show("detail");
      return;
    }

    if (origin && origin.screen) {
      /*
       * Canal aberto diretamente da grade:
       * volta para a própria grade.
       */
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
        show("home");
        setActiveTab("home");
        return;
      }
    }

    state.detail = null;
    show("home");
    setActiveTab("home");
  }

  /* ---------------- Sair ---------------- */
  function logout() {
    try { LS.removeItem("stv_profile"); } catch (e) {}
    try { LS.removeItem(CATALOG_CACHE_KEY); } catch (e) {}
    destroyPlayer();
    state.profile = null;
    state.playing = null;
    state.detail = null;
    state.detailOrigin = null;
    state.playerOrigin = null;
    state.lastFocus = {};
    $("#login-msg").textContent = "";
    $("#in-pass").value = "";
    show("login");
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

    if (state.screen === "player") {
      e.preventDefault();
      if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE || k === KEY.STOP) return exitPlayer();
      if (k === KEY.UP || k === KEY.DOWN) return moveOsdSel(k === KEY.DOWN ? "down" : "up");
      if (k === KEY.ENTER || k === KEY.PLAY || k === KEY.PAUSE || k === KEY.PLAYPAUSE) {
        var sel = osdButtons()[osdSel];
        if (sel && $("#player-osd").classList.contains("show")) { sel.click(); return; }
        return togglePlay();
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
    if (state.screen === "home") {
      if (window.webOS && window.webOS.platformBack) window.webOS.platformBack();
      else if (window.close) window.close();
      return;
    }
    if (state.screen === "login") return;

    if (state.screen === "detail") {
      /*
       * Volta apenas para a tela de onde este detalhe foi aberto agora.
       */
      var origin = state.detailOrigin;
      state.detailOrigin = null;
      state.detail = null;
      if (origin === "grid" || origin === "search") { show(origin); return; }
      show("home");
      setActiveTab("home");
      return;
    }

    state.detail = null;
    state.detailOrigin = null;
    show("home");
    setActiveTab("home");
  }

  function setActiveTab(name) {
    $$(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
  }

  /* ---------------- Bind ---------------- */
  function init() {
    video = $("#video");

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
        show("home");
        setActiveTab("home");
      } else {

        /*
         * Primeira abertura após esta atualização:
         * ainda não existe cache.
         *
         * Mostra Home enquanto busca catálogo,
         * sem voltar para o formulário de login.
         */
        show("home");
        setActiveTab("home");

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
     * Login aparece somente quando não existe
     * nenhuma conta salva.
     */
    show("login");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
