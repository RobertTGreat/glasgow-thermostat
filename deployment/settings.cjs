'use strict';
const path = require('node:path');
const role = process.env.NR_ROLE || 'server';
const host = process.env.NR_HOST || '127.0.0.1';
if (role !== 'device' && !process.env.NR_ADMIN_HASH) throw Error('Refusing to start server without admin authentication');
if (!process.env.NR_CREDENTIAL_SECRET) throw Error('Set a private Node-RED credential encryption secret');
if (role === 'device' && host !== '127.0.0.1') throw Error('Device editor must remain loopback-only');
module.exports = {
    uiPort: Number(process.env.NR_PORT || 1880), uiHost: host,
    flowFile: 'flows.json', flowFilePretty: true,
    credentialSecret: process.env.NR_CREDENTIAL_SECRET,
    // Never scan ALL node_modules as loose nodes: dependency example.html files
    // can be mistaken for palette nodes and stop the editor loading.
    nodesDir: [
        path.join(process.env.NR_NODES_DIR || path.resolve(__dirname, '../../node_modules'), 'node-red-dashboard/nodes'),
        path.join(process.env.NR_NODES_DIR || path.resolve(__dirname, '../../node_modules'), 'node-red-node-openweathermap'),
        path.join(process.env.NR_NODES_DIR || path.resolve(__dirname, '../../node_modules'), 'node-red-node-pi-sense-hat-simulator')
    ],
    adminAuth: role === 'device' ? undefined : {
        type: 'credentials', users: [{username:'admin',password:process.env.NR_ADMIN_HASH,permissions:'*'}]
    },
    contextStorage: {default:'file', file:{module:'localfilesystem',config:{flushInterval:5}}},
    functionExternalModules: false, exportGlobalContextKeys: false,
    httpAdminRoot: '/', httpNodeRoot: '/', ui: {path:'ui'},
    editorTheme: {page:{title:role==='device'?'Local Sense HAT thermostat':'Cloud Glasgow thermostat'},projects:{enabled:false}},
    logging: {console:{level:'info',metrics:false,audit:false}},
    diagnostics: {enabled:false,ui:false}, runtimeState: {enabled:false,ui:false}
};
