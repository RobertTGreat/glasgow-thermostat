// Embedded in exported Function nodes: no external JS module is needed on import.
const DEVICE_ID = "__DEVICE_ID__";
const WEATHER_MAX_AGE = __MAX_AGE_MS__;
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
const inRange = (v, min, max) => isNumber(v) && v >= min && v <= max;
function parseObject(value) {
    if (typeof value === "string") {
        if (value.length > 32768) throw Error("Message exceeds 32 KiB");
        value = JSON.parse(value);
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Expected a JSON object");
    return value;
}
function validWeather(w) {
    return w && w.schemaVersion === 1 && w.deviceId === DEVICE_ID &&
        w.city === "Glasgow" && inRange(w.tempc, -60, 60) &&
        inRange(w.tempMinc, -60, 60) && inRange(w.tempMaxc, -60, 60) &&
        w.tempMinc <= w.tempc && w.tempc <= w.tempMaxc &&
        inRange(w.humidity, 0, 100) && typeof w.description === "string" &&
        w.description.length > 0 && w.description.length <= 200 &&
        inRange(w.sunrise, 1, 1e11) && inRange(w.sunset, 1, 1e11) &&
        w.sunrise < w.sunset && inRange(w.timestamp, 1e12, Date.now() + 300000) &&
        inRange(w.receivedAt, 1e12, Date.now() + 300000);
}
function weatherFresh(w) {
    return validWeather(w) && Date.now() - w.timestamp <= WEATHER_MAX_AGE &&
        Date.now() - w.receivedAt <= WEATHER_MAX_AGE;
}
function validSetpoint(s) {
    return s && s.schemaVersion === 1 && s.deviceId === DEVICE_ID &&
        s.unit === "C" && inRange(s.setpointC, -10, 35) &&
        inRange(s.timestamp, 1e12, Date.now() + 300000);
}
function reject(reason) {
    node.status({fill:"yellow", shape:"ring", text:reason});
    // Do not echo untrusted payloads/credentials into logs.
    node.warn(reason);
    return null;
}
