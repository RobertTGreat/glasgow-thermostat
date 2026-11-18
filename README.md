# Glasgow thermostat

A Node-RED thermostat demonstration with a Sense HAT simulator, live Glasgow weather from OpenWeatherMap, and MQTT. The simulator sends the setpoint and scrolls the outdoor temperature on its LED matrix. The dashboard shows five gauges and one-hour temperature and humidity charts. The status page shows whether heating would be on.

## Run locally

You will need Node.js 22 or later, Python 3, and an OpenWeatherMap API key.

```sh
npm ci
npm run build
npm test
```

Start a local MQTT broker in a separate terminal. The included Aedes dependency can serve the demo on TCP port 1883.

```sh
node -e "const broker = require('aedes')(); require('node:net').createServer(broker.handle).listen(1883, '127.0.0.1')"
```

1. Run `python tools/start_device.py` and open the [Node-RED editor](http://127.0.0.1:1880/). The launcher loads the Sense HAT flow.
2. Import [`flows/Parts_B_C_server_cloud.json`](flows/Parts_B_C_server_cloud.json) into the same editor. Enter your private key in the OpenWeatherMap node's API key field, then deploy.
3. Open the [Sense HAT simulator](http://127.0.0.1:1880/sensehat-simulator) and use its temperature controls to change the setpoint. The [dashboard](http://127.0.0.1:1880/ui/) and [heating status](http://127.0.0.1:1880/status) display the latest results.

The heating status is **ON** when the outdoor temperature is below the setpoint and **OFF** when it is equal to or above it. Missing or stale weather produces **WAITING**.

## Run the device and server separately

Configure a broker both hosts can reach in `config.json`, choose a unique `topicRoot`, and run `npm run build`. Load Part A on the device and the combined B/C export on the server. See the [generated MQTT topic map](docs/mqtt-topics.json).

Use [`deployment/settings.cjs`](deployment/settings.cjs) on the server. Set `NR_ROLE=server`, `NR_NODES_DIR` to the installed project dependencies, `NR_ADMIN_HASH` to a bcrypt hash for the editor login, and `NR_CREDENTIAL_SECRET` to a private encryption secret. `NR_HOST` defaults to loopback. Use HTTPS and restrict access when exposing the dashboard or editor remotely.

The build embeds the JavaScript, HTML, and CSS from `src/` into the JSON exports. `npm ci` applies an HTTPS patch to the pinned OpenWeatherMap palette node.
