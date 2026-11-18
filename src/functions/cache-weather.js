// Prefer the complete OWM response (msg.data) over the palette's truncated tempc.
try {
    const raw = parseObject(msg.data);
    const kelvinToC = (v) => isNumber(v) ? Number((v - 273.15).toFixed(2)) : NaN;
    if (raw.sys?.country !== "GB" || !/glasgow/i.test(raw.name || "")) {
        return reject("Rejected weather for a different city");
    }
    const w = {
        schemaVersion: 1, deviceId: DEVICE_ID, city: "Glasgow",
        tempc: kelvinToC(raw.main?.temp),
        tempMinc: kelvinToC(raw.main?.temp_min),
        tempMaxc: kelvinToC(raw.main?.temp_max),
        humidity: raw.main?.humidity,
        description: raw.weather?.[0]?.description,
        sunrise: raw.sys?.sunrise, sunset: raw.sys?.sunset,
        timestamp: isNumber(raw.dt) ? raw.dt * 1000 : NaN,
        receivedAt: Date.now()
    };
    if (!weatherFresh(w)) return reject("Rejected invalid or stale OWM response");
    const previous = global.get("thermostat.weather");
    if (previous && w.timestamp < previous.timestamp) return reject("Ignored older OWM observation");
    global.set("thermostat.weather", {...w, raw});
    let history = global.get("thermostat.history") || [];
    history = history.filter(p => p.timestamp >= Date.now() - 3600000 && p.timestamp !== w.timestamp);
    history.push({timestamp:w.timestamp, tempc:w.tempc, humidity:w.humidity});
    history.sort((a,b) => a.timestamp - b.timestamp);
    global.set("thermostat.history", history.slice(-720));
    node.status({fill:"green", shape:"dot", text:w.tempc + " C | Glasgow cached"});
    return [{payload:JSON.stringify(w)}, {topic:"weather-updated"}];
} catch (_) {
    return reject("Invalid OWM response; keeping last good observation");
}
