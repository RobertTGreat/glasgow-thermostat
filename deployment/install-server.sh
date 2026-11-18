#!/usr/bin/env bash
# Run via gcloud compute ssh ... --command='sudo bash .../install-server.sh'
# A private provisioning.json is copied separately, never into the submission.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
ARCHIVE="${1:?Pass the uploaded source tar.gz}"
PRIVATE="${2:?Pass the private provisioning.json path}"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg python3
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o /tmp/nodesource.asc
gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg /tmp/nodesource.asc
printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main\n' > /etc/apt/sources.list.d/nodesource.list
apt-get update -qq
apt-get install -y -qq nodejs
id node-red >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/node-red --shell /usr/sbin/nologin node-red
install -d -o node-red -g node-red /opt/thermostat /var/lib/node-red
# Abort if overwriting a previously deployed flow would lose user edits.
if systemctl is-active --quiet thermostat-node-red; then
    echo 'Service already active; stop intentionally before a replacement deployment.' >&2
    exit 1
fi
tar -xzf "$ARCHIVE" -C /opt/thermostat
chown -R node-red:node-red /opt/thermostat
cd /opt/thermostat
runuser -u node-red -- npm ci --omit=dev --no-audit --no-fund
cp flows/Parts_B_C_server_cloud.json /var/lib/node-red/flows.json
cp deployment/settings.cjs /var/lib/node-red/settings.cjs
install -d -m 0750 -o root -g node-red /etc/thermostat
python3 - "$PRIVATE" <<'PY'
import json, pathlib, sys
secret = json.loads(pathlib.Path(sys.argv[1]).read_text())
# Generated values are hex or bcrypt; restrict the provisioning file before running this script.
env = {
    'NR_ROLE':'server','NR_HOST':'0.0.0.0','NR_PORT':'1880',
    'NR_NODES_DIR':'/opt/thermostat/node_modules',
    'NR_ADMIN_HASH':secret['adminHash'],
    'NR_CREDENTIAL_SECRET':secret['credentialSecret']
}
pathlib.Path('/etc/thermostat/runtime.env').write_text(''.join(f'{k}={v}\n' for k,v in env.items()))
pathlib.Path('/var/lib/node-red/flows_cred.json').write_text(json.dumps({'b_owm':{'apikey':secret['owmApiKey']}}))
PY
chown root:node-red /etc/thermostat/runtime.env
chmod 0640 /etc/thermostat/runtime.env
chown -R node-red:node-red /var/lib/node-red
chmod 0700 /var/lib/node-red
chmod 0600 /var/lib/node-red/flows_cred.json
cat > /etc/systemd/system/thermostat-node-red.service <<'UNIT'
[Unit]
Description=Glasgow thermostat Node-RED server
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=node-red
Group=node-red
WorkingDirectory=/opt/thermostat
EnvironmentFile=/etc/thermostat/runtime.env
ExecStart=/usr/bin/node /opt/thermostat/node_modules/node-red/red.js --userDir /var/lib/node-red --settings /var/lib/node-red/settings.cjs
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/node-red
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now thermostat-node-red
rm -f "$PRIVATE" /tmp/nodesource.asc
systemctl is-active thermostat-node-red
