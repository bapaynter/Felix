#!/bin/bash
# Weather forecast script using Open-Meteo (no API key needed)

LAT="43.07"
LON="-89.40"

# Get the forecast
DATA=$(curl -s "https://api.open-meteo.com/v1/forecast?latitude=$LAT&longitude=$LON&daily=weathercode,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto")

# Function to convert WMO code to readable text
wmo() {
  case $1 in
    0) echo "☀️ Clear" ;;
    1) echo "🌤 Mostly Clear" ;;
    2) echo "⛅ Partly Cloudy" ;;
    3) echo "🌥️ Overcast" ;;
    45|48) echo "🌫️ Foggy" ;;
    51|53|55) echo "🌧️ Drizzle" ;;
    61|63|65) echo "🌧️ Rain" ;;
    71|73|75) echo "❄️ Snow" ;;
    80|81|82) echo "🌦️ Showers" ;;
    95|96|99) echo "⛈️ Thunderstorm" ;;
    *) echo "❓ Code $1" ;;
  esac
}

echo "📅 7-Day Forecast (Madison, WI)"
echo "-------------------------------"

# Parse JSON and output nicely
for i in 0 1 2 3 4 5 6; do
  DATE=$(echo "$DATA" | jq -r ".daily.time[$i]")
  CODE=$(echo "$DATA" | jq -r ".daily.weathercode[$i]")
  HIGH=$(echo "$DATA" | jq -r ".daily.temperature_2m_max[$i]")
  LOW=$(echo "$DATA" | jq -r ".daily.temperature_2m_min[$i]")
  
  # Format day name
  if [ "$i" = "0" ]; then
    DAY="Today"
  elif [ "$i" = "1" ]; then
    DAY="Tmrw"
  else
    DAY=$(date -d "$DATE" +%a)
  fi
  
  CONDITION=$(wmo $CODE)
  printf "%-5s %-20s ↑%s°F ↓%s°F\n" "$DAY" "$CONDITION" "$HIGH" "$LOW"
done
