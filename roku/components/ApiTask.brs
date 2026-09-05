' ApiTask — toda a rede do DarkTV roda aqui (fora da thread de render).
' Mesmos endpoints do app web (Xtream + liberação de acesso + PIX).

sub init()
    m.top.functionName = "run"
end sub

' ---- constantes iguais ao app.js ----
function ACCESS_URL() as String
    return "https://mabdjbzjgsjxbdhrkvmb.supabase.co/rest/v1/rpc/check_device_access"
end function
function ACCESS_KEY() as String
    return "sb_publishable_VUiAXt82sNXB6sDk4eeQCQ_ablSGLNc"
end function
function PIX_CHECKOUT_URL() as String
    return "https://mabdjbzjgsjxbdhrkvmb.supabase.co/functions/v1/pix-checkout"
end function
function PIX_STATUS_URL() as String
    return "https://mabdjbzjgsjxbdhrkvmb.supabase.co/functions/v1/pix-status"
end function
function DEVICE_CONFIG_URL() as String
    return "https://api.github.com/repos/limonada77/webos-showcase-player/contents/public/device-config.json?ref=main"
end function
function CONFIG_KEY_B64() as String
    return "orcOggT4W+iiKh5m3/MWqYipHn29xcnjgXV7iAdETjY="
end function

sub run()
    a = m.top.action
    p = m.top.params
    if p = invalid then p = {}
    res = {}
    if a = "login"
        res = doLogin(p)
    else if a = "catalog"
        res = doCatalog(p)
    else if a = "series_info"
        res = doSeriesInfo(p)
    else if a = "vod_info"
        res = doVodInfo(p)
    else if a = "access_check"
        res = doAccessCheck(p)
    else if a = "remote_entry"
        res = doRemoteEntry(p)
    else if a = "pix_status"
        res = doPixStatus(p)
    else if a = "pix_checkout"
        res = doPixCheckout(p)
    end if
    res.action = a
    res.tag = m.top.tag
    m.top.result = res
end sub

' ---------------- HTTP ----------------
function httpFetch(url as String, method as String, headers as Object, body as String, timeoutMs as Integer) as Object
    ut = CreateObject("roUrlTransfer")
    port = CreateObject("roMessagePort")
    ut.SetMessagePort(port)
    ut.SetUrl(url)
    ut.SetCertificatesFile("common:/certs/ca-bundle.crt")
    ut.InitClientCertificates()
    ut.EnableHostVerification(false)
    ut.EnablePeerVerification(false)
    ut.RetainBodyOnError(true)
    ut.AddHeader("User-Agent", "DarkTV Roku/1.0")
    if headers <> invalid
        for each k in headers
            ut.AddHeader(k, headers[k])
        end for
    end if
    ok = false
    if method = "POST"
        ut.SetRequest("POST")
        ok = ut.AsyncPostFromString(body)
    else
        ok = ut.AsyncGetToString()
    end if
    if not ok then return { code: -1, body: "" }
    msg = wait(timeoutMs, port)
    if type(msg) = "roUrlEvent"
        return { code: msg.GetResponseCode(), body: msg.GetString() }
    end if
    ut.AsyncCancel()
    return { code: -2, body: "" }
end function

function getJson(url as String) as Dynamic
    r = httpFetch(url, "GET", invalid, "", 30000)
    if r.code < 200 or r.code >= 300 then return invalid
    return ParseJson(r.body)
end function

function postJson(url as String, headers as Object, payload as Object, timeoutMs as Integer) as Dynamic
    h = { "Content-Type": "application/json" }
    if headers <> invalid
        for each k in headers
            h[k] = headers[k]
        end for
    end if
    r = httpFetch(url, "POST", h, FormatJson(payload), timeoutMs)
    if r.code < 200 or r.code >= 300 then return invalid
    return ParseJson(r.body)
end function

' ---------------- Xtream ----------------
function apiUrl(p as Object, action as String, extra = "" as String) as String
    u = p.host + "/player_api.php?username=" + urlEnc(p.user) + "&password=" + urlEnc(p.pass)
    if action <> "" then u = u + "&action=" + action
    return u + extra
end function

function doLogin(p as Object) as Object
    data = getJson(apiUrl(p, ""))
    if not isAA(data) or not isAA(data.user_info) or sVal(data.user_info.auth) <> "1"
        if data = invalid then return { ok: false, error: "Falha ao conectar" }
        return { ok: false, error: "Usuário ou senha inválidos" }
    end if
    ui = data.user_info
    return {
        ok: true
        user_info: {
            username: sVal(ui.username)
            exp_date: sVal(ui.exp_date)
            status: sVal(ui.status)
            active_cons: sVal(ui.active_cons, "0")
            max_connections: sVal(ui.max_connections, "—")
        }
    }
end function

function slimCats(list as Dynamic) as Object
    out = []
    if not isArr(list) then return out
    for each c in list
        if isAA(c) then out.Push({ id: sVal(c.category_id), name: sVal(c.category_name, "Categoria") })
    end for
    return out
end function

function slimItems(list as Dynamic, kind as String) as Object
    out = []
    if not isArr(list) then return out
    for each it in list
        if isAA(it)
            id = ""
            if kind = "series" then id = sVal(it.series_id) else id = sVal(it.stream_id)
            added = nVal(it.added)
            if added = 0 then added = nVal(it.last_modified)
            bd = ""
            if isArr(it.backdrop_path) and it.backdrop_path.Count() > 0 then bd = sVal(it.backdrop_path[0])
            out.Push({
                id: id
                name: sVal(it.name, sVal(it.title))
                cover: pickImage(it)
                cat: sVal(it.category_id)
                added: added
                ext: sVal(it.container_extension, "mp4")
                rating: sVal(it.rating)
                plot: sVal(it.plot)
                releaseDate: sVal(it.releaseDate, sVal(it.release_date))
                backdrop: bd
                kind: kind
            })
        end if
    end for
    return out
end function

function doCatalog(p as Object) as Object
    liveCats = slimCats(getJson(apiUrl(p, "get_live_categories")))
    vodCats = slimCats(getJson(apiUrl(p, "get_vod_categories")))
    serCats = slimCats(getJson(apiUrl(p, "get_series_categories")))
    movies = slimItems(getJson(apiUrl(p, "get_vod_streams")), "movie")
    series = slimItems(getJson(apiUrl(p, "get_series")), "series")
    live = slimItems(getJson(apiUrl(p, "get_live_streams")), "live")
    return { ok: true, liveCats: liveCats, movieCats: vodCats, seriesCats: serCats, movies: movies, series: series, live: live }
end function

function doSeriesInfo(p as Object) as Object
    info = getJson(apiUrl(p, "get_series_info", "&series_id=" + urlEnc(sVal(p.series_id))))
    out = { ok: false, plot: "", backdrop: "", seasons: [] }
    if not isAA(info) then return out
    out.ok = true
    if isAA(info.info)
        out.plot = sVal(info.info.plot)
        if isArr(info.info.backdrop_path) and info.info.backdrop_path.Count() > 0 then out.backdrop = sVal(info.info.backdrop_path[0])
    end if
    eps = info.episodes
    keys = []
    if isAA(eps)
        for each k in eps
            keys.Push(k)
        end for
    else if isArr(eps)
        ' alguns servidores devolvem array de temporadas
        tmp = {}
        for i = 0 to eps.Count() - 1
            tmp[(i + 1).ToStr()] = eps[i]
        end for
        eps = tmp
        for each k in eps
            keys.Push(k)
        end for
    end if
    ' ordena numericamente
    n = keys.Count()
    for i = 0 to n - 2
        for j = i + 1 to n - 1
            if Val(keys[j]) < Val(keys[i])
                t = keys[i]
                keys[i] = keys[j]
                keys[j] = t
            end if
        end for
    end for
    for each k in keys
        list = eps[k]
        season = { key: k, episodes: [] }
        if isArr(list)
            for each ep in list
                if isAA(ep)
                    inf = ep.info
                    if not isAA(inf) then inf = {}
                    ext = sVal(ep.container_extension)
                    if ext = "" then ext = sVal(inf.container_extension, "mp4")
                    num = sVal(ep.episode_num)
                    title = sVal(ep.title)
                    if title = "" then title = "Episódio " + num
                    season.episodes.Push({
                        id: sVal(ep.id, sVal(ep.stream_id))
                        num: num
                        title: title
                        ext: ext
                        sub: sVal(inf.duration, sVal(inf.plot))
                    })
                end if
            end for
        end if
        out.seasons.Push(season)
    end for
    return out
end function

function doVodInfo(p as Object) as Object
    info = getJson(apiUrl(p, "get_vod_info", "&vod_id=" + urlEnc(sVal(p.vod_id))))
    out = { ok: false, plot: "", backdrop: "", genre: "", duration: "" }
    if not isAA(info) or not isAA(info.info) then return out
    out.ok = true
    out.plot = sVal(info.info.plot, sVal(info.info.description))
    out.genre = sVal(info.info.genre)
    out.duration = sVal(info.info.duration)
    if isArr(info.info.backdrop_path) and info.info.backdrop_path.Count() > 0 then out.backdrop = sVal(info.info.backdrop_path[0])
    return out
end function

' ---------------- Liberação de acesso ----------------
function doAccessCheck(p as Object) as Object
    h = { "apikey": ACCESS_KEY(), "Authorization": "Bearer " + ACCESS_KEY() }
    r = httpFetch(ACCESS_URL(), "POST", { "Content-Type": "application/json", "apikey": ACCESS_KEY(), "Authorization": "Bearer " + ACCESS_KEY() }, FormatJson({ p_hash: p.hash }), 15000)
    if r.code < 200 or r.code >= 300 then return { ok: false, granted: false }
    granted = (r.body.Trim() = "true")
    return { ok: true, granted: granted }
end function

function b64Decode(s as String) as Object
    clean = CreateObject("roRegex", "\s", "").ReplaceAll(s, "")
    ba = CreateObject("roByteArray")
    ba.FromBase64String(clean)
    return ba
end function

' Decripta "v1.<iv_b64>.<cipher+tag b64>" (AES-256-GCM) como o app web.
function decryptRemoteConfig(value as String) as String
    parts = value.Split(".")
    if parts.Count() <> 3 or parts[0] <> "v1" then return ""
    keyHex = b64Decode(CONFIG_KEY_B64()).ToHexString()
    ivHex = b64Decode(parts[1]).ToHexString()
    encHex = b64Decode(parts[2]).ToHexString()
    if encHex.Len() <= 32 then return ""
    bodyHex = Left(encHex, encHex.Len() - 32)
    body = CreateObject("roByteArray")
    body.FromHexString(bodyHex)
    c = CreateObject("roEVPCipher")
    rc = c.Setup(false, "aes-256-gcm", keyHex, ivHex, 0)
    if rc <> 0 then return ""
    out = c.Update(body)
    if out = invalid then return ""
    fin = c.Final()
    if fin <> invalid and type(fin) = "roByteArray" then out.Append(fin)
    return out.ToAsciiString()
end function

function doRemoteEntry(p as Object) as Object
    r = httpFetch(DEVICE_CONFIG_URL() + "&ts=" + Int(nowSec()).ToStr(), "GET", { "Accept": "application/vnd.github+json" }, "", 20000)
    if r.code < 200 or r.code >= 300 then return { ok: false }
    payload = ParseJson(r.body)
    if not isAA(payload) or payload.content = invalid then return { ok: false }
    data = ParseJson(b64Decode(sVal(payload.content)).ToAsciiString())
    if not isAA(data) or not isArr(data.devices) then return { ok: true, found: false }
    found = invalid
    for each item in data.devices
        if isAA(item) and LCase(sVal(item.hash)) = p.hash
            found = item
            exit for
        end if
    end for
    if found = invalid then return { ok: true, found: false }
    entry = {
        hash: sVal(found.hash)
        active: (found.active <> false)
        source: sVal(found.source, "admin")
        duration: sVal(found.duration, "forever")
        expiresAt: sVal(found.expiresAt)
    }
    profile = invalid
    xe = sVal(found.xtream_enc)
    if xe <> ""
        plain = decryptRemoteConfig(xe)
        if plain <> ""
            raw = ParseJson(plain)
            if isAA(raw) and sVal(raw.host) <> "" and sVal(raw.user) <> "" and sVal(raw.pass) <> ""
                profile = { host: normHost(sVal(raw.host)), user: sVal(raw.user), pass: sVal(raw.pass) }
            end if
        end if
    end if
    return { ok: true, found: true, entry: entry, profile: profile }
end function

function doPixStatus(p as Object) as Object
    data = postJson(PIX_STATUS_URL(), invalid, { device_hash: p.hash }, 15000)
    if not isAA(data) then return { ok: false }
    if data.paid <> true or sVal(data.paid_at) = "" then return { ok: true, paid: false }
    paidSec = parseIsoSec(data.paid_at)
    if paidSec <= 0 then return { ok: true, paid: false }
    dt = CreateObject("roDateTime")
    dt.FromSeconds(Int(paidSec))
    return { ok: true, paid: true, policy: { source: "pix", duration: "month", paidAt: dt.ToISOString(), expiresAt: addMonthsIso(paidSec, 1) } }
end function

function doPixCheckout(p as Object) as Object
    data = postJson(PIX_CHECKOUT_URL(), invalid, { device_hash: p.hash }, 15000)
    if not isAA(data) then return { ok: false }
    if data.ready <> true or sVal(data.qr_data_url) = "" then return { ok: true, ready: false }
    url = sVal(data.qr_data_url)
    path = ""
    idx = Instr(1, url, ",")
    if Left(url, 5) = "data:" and idx > 0
        ba = b64Decode(Mid(url, idx + 1))
        ext = "png"
        if Instr(1, url, "image/jpeg") > 0 then ext = "jpg"
        path = "tmp:/pix_qr_" + Int(nowSec()).ToStr() + "." + ext
        ba.WriteFile(path)
    else if Left(url, 4) = "http"
        path = url
    end if
    return { ok: true, ready: (path <> ""), path: path }
end function
