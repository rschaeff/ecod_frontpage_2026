#!/usr/bin/env bash
# Fetch the current DB-IP "IP to City Lite" database for usage-statistics locations.
#
#   scripts/update_geoip.sh [DEST_DIR]
#
# DEST_DIR defaults to /data/ECOD/html/geoip (sangala path; /data/ECOD0/html/geoip on
# leda is the same filesystem). It must be OUTSIDE the app directory, because deploy.sh
# rsyncs with --delete. The app reads $DEST_DIR/dbip-city-lite.mmdb (GEOIP_DB) and
# notices a replaced file by polling, so no restart is needed after an update.
#
# DB-IP Lite is CC BY 4.0: credit "IP Geolocation by DB-IP" (https://db-ip.com) wherever
# the data is shown, including maps and reports built from usage_geo_monthly.
# New editions appear early each month; run monthly (e.g. cron on the 3rd).
set -euo pipefail

DEST=${1:-/data/ECOD/html/geoip}
NAME=dbip-city-lite.mmdb
mkdir -p "$DEST"
WORK=$(mktemp -d "$DEST/.download.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

fetched=
for month in "$(date -u +%Y-%m)" "$(date -u -d "$(date -u +%Y-%m-01) -1 month" +%Y-%m)"; do
    url="https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz"
    if curl -fsS -m 600 -o "$WORK/db.mmdb.gz" "$url"; then
        fetched=$month
        break
    fi
    echo "  $month not available yet, trying the previous month" >&2
done
[ -n "$fetched" ] || { echo "Download failed" >&2; exit 1; }

gzip -t "$WORK/db.mmdb.gz"
gunzip "$WORK/db.mmdb.gz"
size=$(stat -c %s "$WORK/db.mmdb")
# A City Lite database is well over 100 MB; anything small is an error page.
if [ "$size" -lt 50000000 ]; then
    echo "Downloaded file is only $size bytes; refusing to install it" >&2
    exit 1
fi
# The MaxMind DB metadata marker must be present near the end of the file.
tail -c 200000 "$WORK/db.mmdb" | grep -aq $'\xab\xcd\xefMaxMind.com' || {
    echo "Downloaded file is not an MMDB database; refusing to install it" >&2
    exit 1
}

chmod 644 "$WORK/db.mmdb"
mv -f "$WORK/db.mmdb" "$DEST/$NAME"   # rename: atomic within the directory
echo "$fetched" > "$DEST/VERSION"
echo "Installed DB-IP City Lite $fetched -> $DEST/$NAME ($((size / 1048576)) MB)"
