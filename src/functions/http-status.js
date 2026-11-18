const w = global.get("thermostat.weather");
const s = global.get("thermostat.setpoint");
const fresh = weatherFresh(w);
const haveSetpoint = validSetpoint(s);
const ready = fresh && haveSetpoint;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const readable = (milliseconds) => new Intl.DateTimeFormat("en-GB", {
    timeZone:"Europe/London", day:"2-digit", month:"short", year:"numeric",
    hour:"2-digit", minute:"2-digit", second:"2-digit", timeZoneName:"short"
}).format(new Date(milliseconds));
// Equality belongs to OFF. No rounded strings, simulated sensor reading, or stale weather in the rule.
const heating = ready ? (w.tempc < s.setpointC ? "ON" : "OFF") : "WAITING";
msg.view = {
    heating, stateClass:heating === "ON" ? "on" : heating === "OFF" ? "off" : "waiting",
    setpoint:haveSetpoint ? s.setpointC + " °C" : "Not received yet",
    temperature:fresh ? w.tempc + " °C" : "Unavailable / stale",
    description:validWeather(w) ? escapeHtml(w.description) : "Awaiting OWM",
    sunrise:validWeather(w) ? escapeHtml(readable(w.sunrise * 1000)) : "Awaiting OWM",
    sunset:validWeather(w) ? escapeHtml(readable(w.sunset * 1000)) : "Awaiting OWM",
    observed:validWeather(w) ? escapeHtml(readable(w.timestamp)) : "Not yet received",
    setpointUpdated:haveSetpoint ? escapeHtml(readable(s.timestamp)) : "Not yet received",
    requested:escapeHtml(readable(Date.now())),
    explanation:!ready ? "Waiting for a device setpoint and current weather." :
        heating === "ON" ? "The outdoor temperature is below the setpoint." :
        "The outdoor temperature is at or above the setpoint.",
    freshness:fresh ? "Weather observation is current" : "Waiting for an up-to-date weather observation"
};
msg.statusCode = ready ? 200 : 503;
msg.headers = {
    "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff", "Referrer-Policy":"no-referrer",
    "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'"
};
return msg;
