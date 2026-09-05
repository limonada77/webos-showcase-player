' ---------- Utilitários compartilhados (MainScene + ApiTask) ----------

function sVal(v as Dynamic, def = "" as String) as String
    if v = invalid then return def
    t = type(v)
    if t = "roString" or t = "String" then return v
    if t = "roInt" or t = "Integer" or t = "roInteger" or t = "LongInteger" or t = "roLongInteger" then return v.ToStr()
    if t = "roFloat" or t = "Float" or t = "roDouble" or t = "Double" then return Str(v).Trim()
    if t = "roBoolean" or t = "Boolean" then
        if v then return "true" else return "false"
    end if
    return def
end function

function nVal(v as Dynamic, def = 0 as Double) as Double
    if v = invalid then return def
    t = type(v)
    if t = "roInt" or t = "Integer" or t = "roInteger" or t = "LongInteger" or t = "roLongInteger" or t = "roFloat" or t = "Float" or t = "roDouble" or t = "Double" then return v
    if t = "roString" or t = "String" then
        if v.Trim() = "" then return def
        return Val(v)
    end if
    return def
end function

function isArr(v as Dynamic) as Boolean
    return v <> invalid and type(v) = "roArray"
end function

function isAA(v as Dynamic) as Boolean
    return v <> invalid and type(v) = "roAssociativeArray"
end function

function nowSec() as Double
    return CreateObject("roDateTime").AsSeconds()
end function

function parseIsoSec(s as Dynamic) as Double
    str = sVal(s)
    if str = "" then return 0
    dt = CreateObject("roDateTime")
    dt.FromISO8601String(str)
    return dt.AsSeconds()
end function

function pad2(n as Integer) as String
    if n < 10 then return "0" + n.ToStr()
    return n.ToStr()
end function

function fmtDate(ts as Dynamic) as String
    n = nVal(ts)
    if n <= 0 then return "Sem vencimento"
    dt = CreateObject("roDateTime")
    dt.FromSeconds(Int(n))
    dt.ToLocalTime()
    return pad2(dt.GetDayOfMonth()) + "/" + pad2(dt.GetMonth()) + "/" + dt.GetYear().ToStr()
end function

function fmtTime(s as Double) as String
    if s < 0 then return "--:--"
    t = Int(s)
    h = Int(t / 3600)
    m = Int((t mod 3600) / 60)
    sec = t mod 60
    out = pad2(m) + ":" + pad2(sec)
    if h > 0 then out = h.ToStr() + ":" + out
    return out
end function

function daysInMonth(y as Integer, m as Integer) as Integer
    if m = 2
        if (y mod 4 = 0 and y mod 100 <> 0) or y mod 400 = 0 then return 29
        return 28
    end if
    if m = 4 or m = 6 or m = 9 or m = 11 then return 30
    return 31
end function

' Soma meses de calendário (igual ao addCalendarMonthsIso do app web).
function addMonthsIso(startSec as Double, months as Integer) as String
    dt = CreateObject("roDateTime")
    dt.FromSeconds(Int(startSec))
    y = dt.GetYear()
    m = dt.GetMonth() + months
    d = dt.GetDayOfMonth()
    while m > 12
        m = m - 12
        y = y + 1
    end while
    last = daysInMonth(y, m)
    if d > last then d = last
    return y.ToStr() + "-" + pad2(m) + "-" + pad2(d) + "T" + pad2(dt.GetHours()) + ":" + pad2(dt.GetMinutes()) + ":" + pad2(dt.GetSeconds()) + "Z"
end function

function normHost(h as String) as String
    s = h.Trim()
    while s.Len() > 0 and Right(s, 1) = "/"
        s = Left(s, s.Len() - 1)
    end while
    if LCase(Left(s, 7)) <> "http://" and LCase(Left(s, 8)) <> "https://" then s = "http://" + s
    return s
end function

function hostLabel(h as String) as String
    s = h
    if LCase(Left(s, 8)) = "https://" then s = Mid(s, 9)
    if LCase(Left(s, 7)) = "http://" then s = Mid(s, 8)
    return s
end function

function urlEnc(s as String) as String
    return CreateObject("roUrlTransfer").Escape(s)
end function

function sha256hex(ascii as String) as String
    ba = CreateObject("roByteArray")
    ba.FromAsciiString(ascii)
    d = CreateObject("roEVPDigest")
    d.Setup("sha256")
    return LCase(d.Process(ba))
end function

function normalizeDeviceId(value as String) as String
    raw = UCase(value.Trim())
    hex = CreateObject("roRegex", "[^0-9A-F]", "").ReplaceAll(raw, "")
    if hex.Len() = 12
        out = ""
        for i = 0 to 5
            if i > 0 then out = out + ":"
            out = out + Mid(hex, i * 2 + 1, 2)
        end for
        return out
    end if
    return raw
end function

function normalizeImageUrl(v as Dynamic) as String
    u = sVal(v).Trim()
    if u = "" then return ""
    if Left(u, 2) = "//" then return "http:" + u
    if LCase(Left(u, 4)) <> "http" then return ""
    return u
end function

function pickImage(it as Object) as String
    keys = ["stream_icon", "cover", "series_cover", "movie_image", "cover_big", "poster", "poster_url", "poster_path", "image", "icon", "logo"]
    for each k in keys
        u = normalizeImageUrl(it[k])
        if u <> "" then return u
    end for
    bp = it["backdrop_path"]
    if isArr(bp) and bp.Count() > 0 then return normalizeImageUrl(bp[0])
    return normalizeImageUrl(bp)
end function
