'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json')));
function source(name) {
    return fs.readFileSync(path.join(root, 'src/functions', name + '.js'), 'utf8')
        .replaceAll('__DEVICE_ID__', config.deviceId)
        .replaceAll('__MAX_AGE_MS__', String(config.weatherMaxAgeMinutes * 60000));
}
const shared = source('shared');
const readUiSource = name => fs.readFileSync(path.join(root, 'src', name), 'utf8');
const statusTemplate = readUiSource('status.html')
    .replace('<!-- status-styles -->', '<style>\n' + readUiSource('status.css') + '</style>');
const tab = (id, label, info) => ({id,type:'tab',label,disabled:false,info});
const note = (id,z,name,x,y) => ({id,z,type:'comment',name,info:'',x,y,wires:[]});
const fn = (id,z,name,file,x,y,wires) => ({id,z,type:'function',name,func:shared+'\n'+source(file),outputs:wires.length,timeout:0,noerr:0,initialize:'',finalize:'',libs:[],x,y,wires});
const inject = (id,z,name,repeat,topic,x,y,to,once=true) => ({id,z,type:'inject',name,props:[{p:'topic',vt:'str'},{p:'payload'}],repeat:String(repeat),crontab:'',once,onceDelay:2,topic,payload:'',payloadType:'date',x,y,wires:[[to]]});
const broker = (id,side) => ({id,type:'mqtt-broker',name:'MQTT broker · '+side,broker:config.broker,port:String(config.brokerPort),clientid:config.topicRoot+'-'+side,autoConnect:true,usetls:config.brokerTls,protocolVersion:'4',keepalive:'60',cleansession:true,autoUnsubscribe:true,birthTopic:'',birthQos:'0',birthPayload:'',birthMsg:{},closeTopic:'',closeQos:'0',closePayload:'',closeMsg:{},willTopic:'',willQos:'0',willPayload:'',willMsg:{},sessionExpiry:''});
const topicBase = `${config.topicRoot}/${config.deviceId}`;
const topics = {weather:topicBase+'/weather/glasgow',setpoint:topicBase+'/control/setpoint'};
const mqttIn = (id,z,name,b,topic,x,y,to) => ({id,z,type:'mqtt in',name,topic,qos:'1',datatype:'json',broker:b,nl:false,rap:true,rh:0,inputs:0,x,y,wires:[[to]]});
const mqttOut = (id,z,name,b,topic,x,y) => ({id,z,type:'mqtt out',name,topic,qos:'1',retain:'true',respTopic:'',contentType:'application/json',userProps:'',correl:'',expiry:'',broker:b,x,y,wires:[]});
const A = 'part_a_device', B = 'part_b_dashboard', C = 'part_c_http';
const device = [
    tab(A,'A · Local Sense HAT thermostat','Run locally only. Simulator temperature +/- control = setpoint (-10–35 C, a demonstration range allowing OFF in cold Glasgow weather). Matrix = OWM Glasgow weather, NOT the simulator temperature. Cached values use localfilesystem context.'),
    note('a_note',A,'LOCAL: /sensehat-simulator · +/- = setpoint · matrix = Glasgow',390,50),
    {id:'a_sense_in',z:A,type:'rpi-sensehatsim in',name:'Simulator setpoint +/- control',motion:false,env:true,stick:false,x:160,y:130,wires:[['a_setpoint']]},
    inject('a_heartbeat',A,'Republish cached setpoint · 60 s',60,'heartbeat',180,200,'a_setpoint'),
    fn('a_setpoint',A,'Validate + cache setpoint → JSON','device-setpoint',490,130,[['a_mqtt_setpoint']]),
    mqttOut('a_mqtt_setpoint',A,'Setpoint → cloud · QoS 1 retained','mqtt_device',topics.setpoint,820,130),
    mqttIn('a_mqtt_weather',A,'Glasgow weather ← cloud','mqtt_device',topics.weather,170,330,'a_temperature'),
    inject('a_scroll',A,'Repeat latest temperature · 12 s',12,'scroll-cached',180,400,'a_temperature'),
    fn('a_temperature',A,'Validate + cache + format “15 C”','device-temperature',500,330,[['a_matrix']]),
    {id:'a_matrix',z:A,type:'rpi-sensehatsim out',name:'Scroll live Glasgow temperature',x:830,y:330,wires:[]},
    note('a_privacy',A,'Public broker: no identity, keys or passwords in messages',410,490),
    broker('mqtt_device','device')
];
const server = [
    tab(B,'B · Cloud weather + dashboard','Deploy on the Google Cloud VM. OWM polled every 10 minutes (144/day). Gauges and 1-hour charts read shared global context. Credentials must be configured separately; none are exported.'),
    tab(C,'C · Cloud HTTP /status','The HTTP handler reads context at request time. ON iff temperature < setpoint; equality is OFF. Missing/stale data returns a labelled 503 WAITING page. Sunrise/sunset use Europe/London, including DST.'),
    note('b_note',B,'CLOUD VM · OWM Glasgow → context → MQTT + dashboard',430,40),
    inject('b_poll',B,'Poll Glasgow · 10 min',600,'',140,110,'b_owm'),
    {id:'b_owm',z:B,type:'openweathermap',name:'OWM Glasgow, GB',wtype:'current',lon:'',lat:'',city:'Glasgow',country:'GB',language:'en',x:370,y:110,wires:[['b_cache']]},
    fn('b_cache',B,'Validate + cache FULL OWM','cache-weather',620,110,[['b_mqtt_weather'],['b_dashboard']]),
    mqttOut('b_mqtt_weather',B,'Glasgow → device · retained','mqtt_server',topics.weather,940,110),
    mqttIn('b_mqtt_setpoint',B,'Setpoint ← device','mqtt_server',topics.setpoint,140,220,'b_setpoint'),
    fn('b_setpoint',B,'Validate + cache setpoint','receive-setpoint',390,220,[['b_dashboard']]),
    inject('b_restore',B,'Restore widgets / stale check · 60 s',60,'',200,360,'b_dashboard'),
    {id:'b_ui_connect',z:B,type:'ui_ui_control',name:'Browser connects → rehydrate',events:'connect',x:210,y:430,wires:[['b_dashboard']]},
    fn('b_dashboard',B,'Read context → all widgets','dashboard',620,360,[['g_current'],['g_max'],['g_min'],['g_humidity'],['g_setpoint'],['c_temperature'],['c_humidity'],['b_freshness']]),
    {id:'b_freshness',z:B,type:'ui_text',group:'group_live',order:1,width:18,height:1,name:'Source / freshness',label:'OpenWeatherMap',format:'{{msg.payload}}',layout:'row-left',className:'thermostat-freshness',x:960,y:610,wires:[]},
    {id:'b_dashboard_styles',z:B,type:'ui_template',name:'Dashboard styles',format:'<style>\n'+readUiSource('dashboard.css')+'</style>',templateScope:'global',x:950,y:665,wires:[[]]},
    note('b_context_note',B,'Persistent GLOBAL context bridges B and C; local FLOW context stays on device',440,540),
    {id:'b_catch',z:B,type:'catch',name:'OWM failure (no key/payload logging)',scope:['b_owm'],uncaught:false,x:220,y:650,wires:[['b_error']]},
    {id:'b_error',z:B,type:'function',name:'Keep cached values; mark OWM unavailable',func:'node.status({fill:"yellow",shape:"ring",text:"OWM unavailable; retaining last good context"});\nreturn null;',outputs:1,timeout:0,noerr:0,initialize:'',finalize:'',libs:[],x:590,y:650,wires:[[]]},
    note('c_note',C,'GET /status → read current context → HTML → response',420,70),
    {id:'c_in',z:C,type:'http in',name:'GET /status',url:'/status',method:'get',upload:false,swaggerDoc:'',x:130,y:190,wires:[['c_view']]},
    fn('c_view',C,'Context + heating rule + London times','http-status',410,190,[['c_html']]),
    {id:'c_html',z:C,type:'template',name:'Labelled heating status HTML',field:'payload',fieldType:'msg',format:'handlebars',syntax:'mustache',template:statusTemplate,output:'str',x:720,y:190,wires:[['c_response']]},
    {id:'c_response',z:C,type:'http response',name:'HTML · no-store · 200 / 503',statusCode:'',headers:{},x:720,y:290,wires:[]},
    note('c_rule',C,'ON: tempc < setpoint · OFF: tempc ≥ setpoint · WAITING: missing/stale data',450,390),
    note('c_timezone',C,'OWM Unix seconds × 1000 → Intl Europe/London (GMT / BST)',420,450),
    broker('mqtt_server','server'),
    {id:'cfg_ui_tab',type:'ui_tab',name:'Glasgow thermostat',icon:'dashboard',disabled:false,hidden:false},
    {id:'group_live',type:'ui_group',name:'Weather and setpoint',tab:'cfg_ui_tab',order:1,disp:true,width:'18',collapse:false,className:'thermostat-readings'},
    {id:'group_history',type:'ui_group',name:'Last hour',tab:'cfg_ui_tab',order:2,disp:true,width:'18',collapse:false,className:'thermostat-history'}
];
const readingColors = {temperature:'#83ddd0',humidity:'#9fbaf0',setpoint:'#ffc28f'};
function gauge(id,label,order,min,max,unit,x,y,{color,className = ''}) {
    return {id,z:B,type:'ui_gauge',name:label,group:'group_live',order:order+1,width:order<=3?6:9,height:3,gtype:'gage',title:label,label:unit,format:'{{value}}',min:String(min),max:String(max),colors:[color,color,color],seg1:'',seg2:'',diff:false,className:('thermostat-gauge '+className).trim(),x,y,wires:[]};
}
server.push(
    gauge('g_current','Current temperature',1,-20,40,'°C',960,230,{color:readingColors.temperature,className:'thermostat-current'}),
    gauge('g_max','Maximum temperature',2,-20,40,'°C',960,280,{color:readingColors.temperature}),
    gauge('g_min','Minimum temperature',3,-20,40,'°C',960,330,{color:readingColors.temperature}),
    gauge('g_humidity','Relative humidity',4,0,100,'%',960,380,{color:readingColors.humidity}),
    gauge('g_setpoint','Thermostat setpoint',5,-10,35,'°C',960,430,{color:readingColors.setpoint,className:'thermostat-setpoint'})
);
for (const [id,label,y,min,max,color] of [['c_temperature','Temperature (°C)',490,-20,40,readingColors.temperature],['c_humidity','Humidity (%)',550,0,100,readingColors.humidity]]) {
    server.push({id,z:B,type:'ui_chart',name:label,group:'group_history',order:id==='c_temperature'?1:2,width:9,height:5,label,chartType:'line',legend:'false',xformat:'HH:mm',interpolate:'linear',nodata:'Awaiting OpenWeatherMap observations',dot:true,ymin:String(min),ymax:String(max),removeOlder:'1',removeOlderPoints:'',removeOlderUnit:'3600',cutout:0,useOneColor:false,useUTC:false,colors:[color],outputs:1,useDifferentColor:false,className:'thermostat-chart',x:970,y,wires:[[]]});
}
server.push({id:'cfg_ui_base',type:'ui_base',theme:JSON.parse(fs.readFileSync(path.join(root,'src/dashboard-theme.json'),'utf8')),site:{name:'Glasgow Thermostat · OWM',hideToolbar:'false',allowSwipe:'false',lockMenu:'false',allowTempTheme:'false',dateFormat:'DD/MM/YYYY',sizes:{sx:48,sy:48,gx:6,gy:6,cx:6,cy:6,px:0,py:0}}});
function write(name, data) {fs.mkdirSync(path.join(root,'flows'),{recursive:true});fs.writeFileSync(path.join(root,'flows',name),JSON.stringify(data,null,2)+'\n');}
write('Part_A_device_local.json',device);
write('Parts_B_C_server_cloud.json',server);
const isPartC=n=>n.id===C||n.z===C;
write('Part_B_server_dashboard.json',server.filter(n=>!isPartC(n)));
write('Part_C_server_http.json',server.filter(isPartC));
fs.mkdirSync(path.join(root,'docs'),{recursive:true});
fs.writeFileSync(path.join(root,'docs','mqtt-topics.json'),JSON.stringify({broker:config.broker,port:config.brokerPort,qos:1,retained:true,topics},null,2)+'\n');
console.log('Built device Part A and server Parts B + C. No credentials in flow exports.');
module.exports = {device,server,topics};
