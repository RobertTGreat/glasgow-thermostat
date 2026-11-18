"""Start the loopback-only device Node-RED without installing a global service."""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import urllib.request

root = Path(__file__).resolve().parent.parent
runtime = root / '.runtime/device'
runtime.mkdir(parents=True, exist_ok=True)
try:
    urllib.request.urlopen('http://127.0.0.1:1880/settings', timeout=2)
except Exception:
    pass
else:
    raise SystemExit('Port 1880 is already serving Node-RED. Not replacing a running instance.')
shutil.copyfile(root / 'flows/Part_A_device_local.json', runtime / 'flows.json')
shutil.copyfile(root / 'deployment/settings.cjs', runtime / 'settings.cjs')
secret_file = root / '.private/device-secret.txt'
secret_file.parent.mkdir(exist_ok=True)
if not secret_file.exists():
    secret_file.write_text(secrets.token_hex(32))
env = dict(os.environ, NR_ROLE='device', NR_HOST='127.0.0.1', NR_PORT='1880',
           NR_NODES_DIR=str(root / 'node_modules'),
           NR_CREDENTIAL_SECRET=secret_file.read_text().strip())
log = open(root / '.runtime/device.log', 'ab')
flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS if os.name == 'nt' else 0
process = subprocess.Popen([shutil.which('node'), str(root / 'node_modules/node-red/red.js'),
                            '--userDir', str(runtime), '--settings', str(runtime / 'settings.cjs')],
                           cwd=root, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                           creationflags=flags, start_new_session=os.name != 'nt')
(root / '.runtime/device.pid').write_text(str(process.pid))
print(f'Local device Node-RED started (PID {process.pid}); logs: .runtime/device.log')
