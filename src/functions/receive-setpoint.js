try {
    const value = parseObject(msg.payload);
    if (!validSetpoint(value)) return reject("Rejected invalid setpoint JSON");
    const previous = global.get("thermostat.setpoint");
    if (previous && value.timestamp < previous.timestamp) return reject("Ignored older setpoint");
    if (previous && value.timestamp === previous.timestamp && value.setpointC !== previous.setpointC) {
        return reject("Conflicting setpoint timestamp");
    }
    // Whitelist fields. Do not persist arbitrary incoming object properties.
    global.set("thermostat.setpoint", {
        schemaVersion:1, deviceId:DEVICE_ID, unit:"C",
        setpointC:value.setpointC, timestamp:value.timestamp, receivedAt:Date.now()
    });
    node.status({fill:"green", shape:"dot", text:value.setpointC + " C received via MQTT"});
    return {topic:"setpoint-updated"};
} catch (_) {
    return reject("Malformed setpoint JSON; last good value unchanged");
}
