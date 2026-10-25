#!/usr/bin/env bash
# Configure the Device over its web server, then restart it.
# Usage: scripts/configure-device.sh <device ip>
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <device ip>" >&2
  exit 1
fi

device="http://$1"

base_url="wss://transit-tracker.conorob.me/"
feed_code="nta"
# route,stop,offset[,direction]. With feed_code set, IDs go without the "nta:" prefix.
schedule=$(
  IFS=";"
  pairs=(
    "BRAY-HOWTH-I,8250IR0111,0,0" # DART at Sandycove and Glasthule, northbound
    "3 111 e a,8250DB003062,0"    # 111 at Breffni Road
    "3 59 d a,8250DB003062,0"     # 59 at Breffni Road
    "1 7D c a,8250DB003062,0"     # 7D at Breffni Road
  )
  echo "${pairs[*]}"
)
# route;name;colour, one per line. The name replaces the route's own on the Device.
route_styles=$(
  IFS=$'\n'
  styles=(
    "BRAY-HOWTH-I;DART;2F8539"
    "3 111 e a;111;0052B7"
    "3 59 d a;59;0052B7"
    "1 7D c a;7D;F3C936"
  )
  echo "${styles[*]}"
)
list_mode="sequential"
# Empty, so every row goes to trips
header_text=""
# from;to, one per line, replacing text inside headsigns
abbreviations=$(
  IFS=$'\n'
  replacements=(
    "Brides Glen Luas;Brides Glen"
  )
  echo "${replacements[*]}"
)
time_display="departure"
time_units="long"
now_str="Now"
min_long_str="min"
min_short_str="m"
hours_short_str="h"

# The Device's web server refuses a POST without Content-Length.
post() {
  curl --fail --silent --show-error -X POST -H "Content-Length: 0" "$device/$1"
}

encode() {
  jq -rn --arg value "$1" '$value | @uri'
}

post "text/base_url_config/set?value=$(encode "$base_url")"
post "text/feed_code_config/set?value=$(encode "$feed_code")"
post "text/schedule_config/set?value=$(encode "$schedule")"
post "text/route_styles_config/set?value=$(encode "$route_styles")"
post "select/list_mode_config/set?option=$(encode "$list_mode")"
post "text/header_text_config/set?value=$(encode "$header_text")"
post "text/abbreviations_config/set?value=$(encode "$abbreviations")"
post "select/time_display_config/set?option=$(encode "$time_display")"
post "select/time_units_config/set?option=$(encode "$time_units")"
post "switch/scroll_headsigns/turn_off"
post "text/now_str_config/set?value=$(encode "$now_str")"
post "text/min_long_str_config/set?value=$(encode "$min_long_str")"
post "text/min_short_str_config/set?value=$(encode "$min_short_str")"
post "text/hours_short_str_config/set?value=$(encode "$hours_short_str")"
post "button/Restart/press"

echo "Configured $1, restarting"
