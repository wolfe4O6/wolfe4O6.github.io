"""Exercise the installer in a temporary HOME with fake host-service commands."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

INSTALLER = Path(__file__).with_name('install.sh').resolve()
FAKE = '''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
name=Path(sys.argv[0]).name; args=sys.argv[1:]; root=Path(os.environ['MAP_TEST_STATE'])
with (root/'calls').open('a') as out: out.write(name+' '+ ' '.join(args)+'\\n')
state=root/'serve.json'
if name=='systemctl':
    if 'is-active' in args: sys.exit(1)
    sys.exit(0)
if name=='loginctl': print('yes'); sys.exit(0)
if name=='curl':
    if any('100.93.108.20:8100' in a for a in args): print(json.dumps({'maps':['world','world_the_nether','world_the_end']}))
    else: print(json.dumps({'ready':True, 'maps':{'world':{'rendered':True}}}))
    sys.exit(0)
if name=='tailscale':
    if args[:1]==['status']:
        print(json.dumps({'BackendState':'Running','Self':{'DNSName':'omarchy.tail715766.ts.net.','TailscaleIPs':['100.93.108.20']}}))
    elif args[:2]==['serve','status']: print(state.read_text())
    elif args[:1]==['funnel']:
        assert '--https=8443' in args and 'reset' not in args
        data=json.loads(state.read_text()); endpoint='omarchy.tail715766.ts.net:8443'
        if 'off' in args:
            for section,key in [('TCP','8443'),('Web',endpoint),('AllowFunnel',endpoint)]: data.get(section,{}).pop(key,None)
        else:
            data.setdefault('TCP',{})['8443']={'HTTPS':True}
            data.setdefault('Web',{})[endpoint]={'Handlers':{'/':{'Proxy':'http://127.0.0.1:8180'}}}
            data.setdefault('AllowFunnel',{})[endpoint]=True
        state.write_text(json.dumps(data))
    else: raise SystemExit('Unexpected tailscale command')
else: raise SystemExit('Unexpected command '+name)
'''

class InstallerTests(unittest.TestCase):
    def scenario(self, conflict=False):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); home=root/'home'; bin_dir=root/'bin'; bin_dir.mkdir()
            (home/'minecraft-server/bluemap/web/maps').mkdir(parents=True)
            before={'TCP':{'443':{'HTTPS':True}}, 'Web':{'omarchy.tail715766.ts.net:443':{'Handlers':{'/':{'Proxy':'http://127.0.0.1:2283'}}}}}
            if conflict: before['TCP']['8443']={'TCPForward':'127.0.0.1:1234'}
            (root/'serve.json').write_text(json.dumps(before))
            for name in ('systemctl','loginctl','tailscale','curl'):
                p=bin_dir/name; p.write_text(FAKE); p.chmod(0o700)
            env={**os.environ, 'HOME':str(home), 'MAP_TEST_STATE':str(root), 'PATH':str(bin_dir)+os.pathsep+os.environ['PATH']}
            run=subprocess.run(['bash',str(INSTALLER)],env=env,capture_output=True,text=True,timeout=15)
            if conflict:
                self.assertNotEqual(run.returncode,0)
                self.assertFalse((home/'.config/systemd/user/minecraft-map.service').exists())
                self.assertEqual(json.loads((root/'serve.json').read_text()),before)
                return
            self.assertEqual(run.returncode,0,run.stderr+run.stdout)
            self.assertIn('Live map installed',run.stdout)
            after=json.loads((root/'serve.json').read_text())
            self.assertEqual(after['Web']['omarchy.tail715766.ts.net:443'],before['Web']['omarchy.tail715766.ts.net:443'])
            self.assertEqual(after['TCP']['443'],before['TCP']['443'])
            self.assertNotIn('omarchy.tail715766.ts.net:443',after['AllowFunnel'])
            self.assertTrue(after['AllowFunnel']['omarchy.tail715766.ts.net:8443'])
            self.assertEqual((home/'.local/share/minecraft-map/map_proxy.py').read_text(),INSTALLER.with_name('map_proxy.py').read_text()+'\n')
            calls=(root/'calls').read_text()
            self.assertNotIn('minecraft.service',calls)
            second=subprocess.run(['bash',str(INSTALLER)],env=env,capture_output=True,text=True,timeout=15)
            self.assertEqual(second.returncode,0,second.stderr+second.stdout)

    def test_install_and_reinstall_preserve_private_443(self): self.scenario()
    def test_conflicting_8443_aborts_without_changing_service(self): self.scenario(conflict=True)

if __name__=='__main__': unittest.main(verbosity=2)
