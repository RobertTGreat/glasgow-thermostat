// The simulator's temperature +/- control is the thermostat setpoint control.
// Environment messages arrive each second; publish every actual change, not every tick.
const previous = flow.get("device.setpoint");
let setpointC;
if (msg.topic === "heartbeat") {
    if (!validSetpoint(previous)) return null; // Do not invent a reading before the simulator starts.
    setpointC = previous.setpointC;
} else {
    const value = msg.payload?.temperature;
    if (!inRange(value, -10, 35)) return reject("Setpoint must be a number between -10 and 35 C");
    setpointC = Number(value.toFixed(1));
    if (validSetpoint(previous) && setpointC === previous.setpointC) return null;
}
const changed = !validSetpoint(previous) || previous.setpointC !== setpointC;
const value = changed ? {
    schemaVersion:1, deviceId:DEVICE_ID, setpointC, unit:"C",
    timestamp:Math.max(Date.now(), (previous?.timestamp || 0) + 1)
} : previous;
flow.set("device.setpoint", value);
node.status({fill:"green", shape:"dot", text:setpointC + " C setpoint | MQTT JSON"});
return {payload:JSON.stringify(value)};
