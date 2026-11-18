'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const config = require('../config.json');
const shared = fs.readFileSync(path.join(__dirname,'../src/functions/shared.js'),'utf8')
    .replaceAll('__DEVICE_ID__',config.deviceId).replaceAll('__MAX_AGE_MS__','1800000');
const store = () => {const values=new Map();return {get:k=>values.get(k),set:(k,v)=>values.set(k,v)};};
function run(file,msg={},context={}) {
    const code=fs.readFileSync(path.join(__dirname,'../src/functions',file+'.js'),'utf8');
    const sandbox={msg,global:context.global||store(),flow:context.flow||store(),node:{status(){},warn(){}},Date,Intl};
    return vm.runInNewContext('(function(){'+shared+'\n'+code+'})()',sandbox);
}
function weather(overrides={}) {
    return {schemaVersion:1,deviceId:config.deviceId,city:'Glasgow',tempc:15.4,tempMinc:14,tempMaxc:17,humidity:70,description:'broken clouds',sunrise:1780000000,sunset:1780050000,timestamp:Date.now()-1000,receivedAt:Date.now(),...overrides};
}
function setpoint(overrides={}) {return {schemaVersion:1,deviceId:config.deviceId,setpointC:21.6,unit:'C',timestamp:Date.now(),...overrides};}
function context(w=weather(),s=setpoint()) {const g=store();if(w)g.set('thermostat.weather',w);if(s)g.set('thermostat.setpoint',s);return {global:g};}
function rawWeather(overrides={}) {return {name:'Glasgow',sys:{country:'GB',sunrise:1780000000,sunset:1780050000},main:{temp:288.55,temp_min:287.15,temp_max:290.15,humidity:70},weather:[{description:'broken clouds'}],dt:Math.floor(Date.now()/1000),...overrides};}
test('OWM Kelvin converts once, full object cached, valid JSON published',()=>{
    const c=context(null,null),raw=rawWeather();const out=run('cache-weather',{data:raw},c);
    const parsed=JSON.parse(out[0].payload);assert.equal(parsed.tempc,15.4);assert.equal(parsed.tempMinc,14);assert.equal(parsed.humidity,70);
    assert.deepEqual(c.global.get('thermostat.weather').raw,raw);assert.equal(c.global.get('thermostat.history').length,1);
});
test('same OWM observation does not create duplicate chart points',()=>{const c=context(null,null),raw=rawWeather();run('cache-weather',{data:raw},c);run('cache-weather',{data:raw},c);assert.equal(c.global.get('thermostat.history').length,1);});
test('negative Celsius conversion is not incorrectly truncated towards zero',()=>{const out=run('cache-weather',{data:rawWeather({main:{temp:272.99,temp_min:272,temp_max:274,humidity:70}})},context(null,null));assert.equal(JSON.parse(out[0].payload).tempc,-0.16);});
test('malformed, wrong-city, missing and stale weather cannot overwrite last good cache',()=>{
    for(const raw of [null,{},rawWeather({name:'London'}),rawWeather({dt:1}),rawWeather({main:{temp:null}})]){
        const c=context(),before=c.global.get('thermostat.weather');assert.equal(run('cache-weather',{data:raw},c),null);assert.equal(c.global.get('thermostat.weather'),before);
    }
});
test('simulator publishes every changed setpoint as JSON; unchanged ticks suppressed',()=>{
    const c={flow:store()};for(const value of [21.6,22.1,18]){const result=run('device-setpoint',{payload:{temperature:value}},c);assert.equal(JSON.parse(result.payload).setpointC,value);assert.equal(run('device-setpoint',{payload:{temperature:value}},c),null);}
    assert.equal(JSON.parse(run('device-setpoint',{topic:'heartbeat'},c).payload).setpointC,18);
});
test('no invented setpoint before first simulator input',()=>{assert.equal(run('device-setpoint',{topic:'heartbeat'}),null);});
test('device rejects invalid setpoints including numeric strings, null and out of range',()=>{for(const value of [null,'21.6',NaN,Infinity,-10.1,35.1,undefined])assert.equal(run('device-setpoint',{payload:{temperature:value}}),null);});
test('server receives valid JSON and duplicate QoS1 delivery is idempotent',()=>{
    const c=context(null,null),s=setpoint();assert.ok(run('receive-setpoint',{payload:JSON.stringify(s)},c));assert.ok(run('receive-setpoint',{payload:s},c));assert.equal(c.global.get('thermostat.setpoint').setpointC,21.6);
});
test('server rejects malformed JSON, wrong device, future timestamps and bad types',()=>{
    const c=context();const before=c.global.get('thermostat.setpoint');for(const value of ['{bad',setpoint({deviceId:'other'}),setpoint({setpointC:'22'}),setpoint({timestamp:Date.now()+600000}),null,[],{setpointC:20}])assert.equal(run('receive-setpoint',{payload:value},c),null);assert.equal(c.global.get('thermostat.setpoint'),before);
});
test('old setpoint delivery never overwrites a newer one',()=>{const c=context();assert.equal(run('receive-setpoint',{payload:setpoint({timestamp:Date.now()-10000})},c),null);assert.equal(c.global.get('thermostat.setpoint').setpointC,21.6);});
test('MQTT weather scrolls formatted live Celsius and repeats cached reading',()=>{const c={flow:store()};assert.equal(run('device-temperature',{payload:JSON.stringify(weather())},c).payload,'15.4 C');assert.equal(run('device-temperature',{topic:'scroll-cached'},c).payload,'15.4 C');});
test('device never scrolls stale, malformed or wrong-device values as live weather',()=>{for(const value of ['not-json',weather({timestamp:Date.now()-3600000}),weather({deviceId:'other'}),weather({tempc:null})])assert.equal(run('device-temperature',{payload:value}),null);assert.equal(run('device-temperature',{topic:'scroll-cached'}),null);});
for(const [label,t,s,result] of [['below',15,21.6,'ON'],['above',22,21.6,'OFF'],['equal',21.6,21.6,'OFF'],['decimal-near-equal',21.59,21.6,'ON']]){
    test('HTTP heating rule: '+label,()=>{const out=run('http-status',{},context(weather({tempc:t,tempMinc:0,tempMaxc:30}),setpoint({setpointC:s})));assert.equal(out.view.heating,result);assert.equal(out.statusCode,200);assert.equal(out.headers['Cache-Control'],'no-store');});
}
test('HTTP reads updated context on each request',()=>{const c=context();assert.equal(run('http-status',{},c).view.heating,'ON');c.global.set('thermostat.setpoint',setpoint({setpointC:5}));assert.equal(run('http-status',{},c).view.heating,'OFF');});
test('missing data and stale weather return 503 WAITING, not an invented decision',()=>{for(const c of [context(null,null),context(weather(),null),context(null,setpoint()),context(weather({timestamp:Date.now()-3600000}))]){const out=run('http-status',{},c);assert.equal(out.view.heating,'WAITING');assert.equal(out.statusCode,503);}});
test('OWM description is HTML-escaped before rendering',()=>{const out=run('http-status',{},context(weather({description:'<script>alert("x")</script>'})));assert.ok(out.view.description.includes('&lt;script&gt;'));assert.ok(!out.view.description.includes('<script>'));});
test('sunrise and sunset use Unix seconds and Europe/London winter/summer timezone',()=>{
    for(const [day,zone,hour] of [['2026-01-01T08:00:00Z','GMT','08:00'],['2026-07-01T08:00:00Z','BST','09:00']]){const sec=Date.parse(day)/1000;const out=run('http-status',{},context(weather({sunrise:sec,sunset:sec+36000})));assert.match(out.view.sunrise,new RegExp(zone));assert.match(out.view.sunrise,new RegExp(hour));}
});
test('all five gauges and both charts read context, history limited to one hour',()=>{
    const c=context();c.global.set('thermostat.history',[{timestamp:Date.now()-7200000,tempc:0,humidity:1},{timestamp:Date.now()-1000,tempc:15.4,humidity:70}]);const out=run('dashboard',{},c);assert.equal(out.length,8);assert.deepEqual(Array.from(out.slice(0,5),x=>x.payload),[15.4,17,14,70,21.6]);assert.equal(out[5].payload[0].data[0].length,1);assert.equal(out[6].payload[0].data[0][0].y,70);for(const chart of out.slice(5,7)){const t=chart.ui_control.options.scales.xAxes[0].time;assert.equal(t.max-t.min,3600000);}
});
test('export structure has unique IDs, valid wires, required widgets and no credentials',()=>{
    for(const file of ['Part_A_device_local.json','Parts_B_C_server_cloud.json','Part_B_server_dashboard.json','Part_C_server_http.json']){
        const nodes=JSON.parse(fs.readFileSync(path.join(__dirname,'../flows',file)));const ids=new Set(nodes.map(n=>n.id));assert.equal(ids.size,nodes.length);for(const n of nodes){assert.notEqual(n.id,n.type,'Node-RED config IDs must not match type names');assert.equal(n.credentials,undefined);for(const wire of n.wires||[])for(const id of wire)assert.ok(ids.has(id),'Missing wire '+id);}
        if(file.startsWith('Parts')){assert.equal(nodes.filter(n=>n.type==='ui_gauge').length,5);const charts=nodes.filter(n=>n.type==='ui_chart');assert.equal(charts.length,2);for(const n of charts)assert.equal(Number(n.removeOlder)*Number(n.removeOlderUnit),3600);}
    }
});
test('installed OWM package never sends key to plain HTTP',()=>{const p=path.join(path.dirname(require.resolve('node-red-node-openweathermap/package.json')),'weather.js');const source=fs.readFileSync(p,'utf8');assert.ok(!source.includes('http://api.openweathermap.org/'));assert.ok(source.includes('https://api.openweathermap.org/data/2.5/weather?'));});
