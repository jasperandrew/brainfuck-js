#!/bin/bash

#--------------------------------------------#
#               Some variables               #
#--------------------------------------------#

serve_dir="./"
serve_port="7777"

#--------------------------------------------#
#               Some functions               #
#--------------------------------------------#

clean () {
	echo "[Info] Cleaning files"
	rm *.log
}

server () {
	echo "[Info] Starting server on port $serve_port..."
	trap "kill 0" EXIT
	cd $serve_dir && python3 -m http.server $serve_port > ../util.server.log 2>&1 &
	wait
}

#--------------------------------------------#
#          Actually doing stuff now          #
#--------------------------------------------#

case "$1" in
	"clean"|"c") clean ;;
	"server"|"s") server ;;
	*) echo "[Error] Invalid argument: $1" ;;
esac