#!/usr/bin/env bash
# Gera o pacote .ipk instalável na LG webOS a partir de public/tv
set -euo pipefail

APP_ID="com.streamtv.app"
VERSION="1.0.0"
SRC="public/tv"
OUT_DIR="public/downloads"
WORK="$(mktemp -d)"
IPK="${OUT_DIR}/${APP_ID}_${VERSION}_all.ipk"

mkdir -p "$OUT_DIR"
rm -f "$IPK"

# ---- data.tar.gz (arquivos do app) ----
APPDIR="$WORK/data/usr/palm/applications/$APP_ID"
mkdir -p "$APPDIR"
cp -r "$SRC"/. "$APPDIR"/
SIZE=$(du -sk "$WORK/data" | cut -f1)

tar --numeric-owner --owner=0 --group=0 -czf "$WORK/data.tar.gz" -C "$WORK/data" .

# ---- control.tar.gz ----
mkdir -p "$WORK/control"
cat > "$WORK/control/control" <<EOF
Package: $APP_ID
Version: $VERSION
Section: misc
Priority: optional
Architecture: all
Installed-Size: $SIZE
Maintainer: StreamTV <dev@streamtv.app>
Description: StreamTV - reprodutor Xtream Codes com interface de streaming para LG webOS
webOS-Package-Format-Version: 2
webOS-Packager-Version: 1.0.0
EOF
tar --numeric-owner --owner=0 --group=0 -czf "$WORK/control.tar.gz" -C "$WORK/control" .

# ---- debian-binary + ar ----
echo "2.0" > "$WORK/debian-binary"
( cd "$WORK" && ar -q -c "$OLDPWD/$IPK" debian-binary control.tar.gz data.tar.gz >/dev/null )

rm -rf "$WORK"
ls -lh "$IPK"
echo "IPK gerado: /$IPK"
