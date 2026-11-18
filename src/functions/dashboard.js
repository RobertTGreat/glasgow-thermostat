// Every widget is populated from context, including on browser reconnect/redeploy.
const w = global.get("thermostat.weather");
const s = global.get("thermostat.setpoint");
const fresh = weatherFresh(w);
const gauge = (value) => ({payload:value});
const chartEnd = Date.now();
const chartStart = chartEnd - 3600000;
const chartAxisColor = "#b4c3c3";
const chartGridColor = "rgba(180, 195, 195, 0.16)";
const history = (global.get("thermostat.history") || [])
    .filter(p => p.timestamp >= chartStart && p.timestamp <= chartEnd + 300000);

function chart(field, label, min, max, stepSize) {
    return {
        payload:[{series:[label],data:[history.map(p => ({x:p.timestamp,y:p[field]}))],labels:[""]}],
        ui_control:{options:{scales:{
            xAxes:[{
                type:"time",
                time:{min:chartStart,max:chartEnd,unit:"minute",unitStepSize:15,displayFormats:{minute:"HH:mm"}},
                ticks:{fontColor:chartAxisColor,maxRotation:0,minRotation:0},
                gridLines:{color:chartGridColor}
            }],
            yAxes:[{ticks:{min,max,stepSize,fontColor:chartAxisColor},gridLines:{color:chartGridColor}}]
        }}}
    };
}

return [
    gauge(fresh ? w.tempc : null), gauge(fresh ? w.tempMaxc : null),
    gauge(fresh ? w.tempMinc : null), gauge(fresh ? w.humidity : null),
    gauge(validSetpoint(s) ? s.setpointC : null),
    chart("tempc", "Glasgow temperature", -20, 40, 20), chart("humidity", "Glasgow humidity", 0, 100, 20),
    {payload:fresh ? "Observed " + new Date(w.timestamp).toLocaleString("en-GB", {timeZone:"Europe/London"}) : "Waiting for current weather"}
];
