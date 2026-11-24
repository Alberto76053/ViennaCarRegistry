#!/bin/bash
# Vollständiger Testlauf: Schema + RLS, dann die UI-Tests gegen echte Postgres-Regeln
cd /home/claude/tools
P="psql -h /tmp/pg -p 54329 -U postgres -d vcr -v ON_ERROR_STOP=1 -q"
stop() { pkill -f "server.py 8765" 2>/dev/null; sleep 0.7; }
start() { stop; (cd /home/claude/tools/h && nohup env "$@" python3 -I server.py 8765 >server.log 2>&1 &); for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:8765/ && break; sleep 0.3; done; }
fresh() { bash reset_db.sh >/dev/null 2>&1; [ "$1" = "empty" ] || $P -f h/seed.sql >/dev/null; }
bash reset_db.sh >/dev/null 2>&1; $P -f rls_test.sql 2>&1 | grep -E "ALL RLS|ALL ADDON|FAIL|ERROR"
run() { echo "== $1 $2"; timeout 240 python3 -I h/$1.py $2 2>&1 | grep -vE "^CONSOLE|^PASS" | tail -8; }
fresh empty; start X=1; run ui_test4 empty
for t in ui_test1 ui_test2 ui_test4 ui_test5; do fresh; start X=1; run $t; done
fresh; start PROVIDERS='["google","apple"]'; run ui_test3
stop
