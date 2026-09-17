"""Fetch versioned public model inputs and vendored browser dependencies."""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/'
SOURCES = {
    'data/raw/annotations.feather': BASE + 'body-annotations-male-cns-v1.0-minconf-0.5.feather',
    'data/raw/neurotransmitters.feather': BASE + 'body-neurotransmitters-male-cns-v1.0.feather',
    'data/raw/edges.feather': BASE + 'connectome-weights-male-cns-v1.0-minconf-0.5.feather',
    'data/raw/official-catalogue.html': 'https://www.gesetze-im-internet.de/einbtestv/anlage_1.html',
    'data/raw/questions-source.json': 'https://raw.githubusercontent.com/leben-in-deutschland/leben-in-deutschland-scrapper/main/data/question.json',
    'dist/vendor/three.module.js': 'https://unpkg.com/three@0.180.0/build/three.module.js',
    'dist/vendor/three.core.js': 'https://unpkg.com/three@0.180.0/build/three.core.js',
    'dist/vendor/addons/controls/OrbitControls.js': 'https://unpkg.com/three@0.180.0/examples/jsm/controls/OrbitControls.js',
    'dist/vendor/THREE-LICENSE.txt': 'https://unpkg.com/three@0.180.0/LICENSE',
}

def fetch(item):
    name, url = item
    p = ROOT / name
    p.parent.mkdir(parents=True, exist_ok=True)
    if not p.exists():
        print('Downloading ' + name, flush=True)
        with urllib.request.urlopen(url, timeout=120) as response, p.with_suffix(p.suffix+'.part').open('wb') as out:
            while chunk := response.read(4*1024*1024):
                out.write(chunk)
        p.with_suffix(p.suffix+'.part').replace(p)
    digest = hashlib.sha256()
    with p.open('rb') as f:
        while chunk := f.read(4*1024*1024): digest.update(chunk)
    result = {'path':name,'url':url,'bytes':p.stat().st_size,'sha256':digest.hexdigest()}
    lock=ROOT/'data/source-lock.json'
    if lock.exists():
        expected=next((r for r in json.loads(lock.read_text()) if r['path']==name),None)
        if expected and expected['sha256']!=result['sha256']:
            raise ValueError('Source changed from the recorded run: '+name)
    print(json.dumps(result),flush=True)
    return result

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        records = list(executor.map(fetch,SOURCES.items()))
    (ROOT/'data').mkdir(exist_ok=True)
    (ROOT/'data/source-lock.json').write_text(json.dumps(records,indent=2)+'\n')
