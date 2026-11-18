try {
    let w;
    if (msg.topic === "scroll-cached") {
        w = flow.get("device.weather");
        if (!weatherFresh(w)) {
            node.status({fill:"yellow",shape:"ring",text:"Waiting for fresh Glasgow weather"});
            return null;
        }
    } else {
        w = parseObject(msg.payload);
        if (!weatherFresh(w)) return reject("Rejected invalid or stale MQTT weather");
        const previous = flow.get("device.weather");
        if (previous && w.timestamp < previous.timestamp) return reject("Ignored older MQTT weather");
        // Only keep expected, non-sensitive fields.
        w = {
            schemaVersion:1, deviceId:DEVICE_ID, city:"Glasgow", tempc:w.tempc,
            tempMinc:w.tempMinc, tempMaxc:w.tempMaxc, humidity:w.humidity,
            description:w.description, sunrise:w.sunrise, sunset:w.sunset,
            timestamp:w.timestamp, receivedAt:w.receivedAt
        };
        flow.set("device.weather", w);
    }
    const text = w.tempc + " C";
    node.status({fill:"green",shape:"dot",text:"OWM Glasgow: " + text});
    return {payload:text, color:"cyan", background:"black", speed:3};
} catch (_) {
    return reject("Malformed MQTT weather JSON; keeping last good reading");
}
