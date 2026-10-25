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
list_mode="sequential"

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
post "select/list_mode_config/set?option=$(encode "$list_mode")"
post "button/Restart/press"

echo "Configured $1, restarting"
