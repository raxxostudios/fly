"""Use German wording and option order from the official regulation.
Secondary scraped keys are matched by answer text, never by option position.
Translations, explanations and generated context are excluded completely.
"""
from pathlib import Path
from html.parser import HTMLParser
import json,re,hashlib,random,unicodedata
ROOT=Path(__file__).resolve().parents[1]
class Text(HTMLParser):
    def __init__(self):super().__init__();self.parts=[]
    def handle_data(self,s):self.parts.append(s)
def plain(html):
    p=Text();p.feed(html);return re.sub(r'\s+',' ',' '.join(p.parts)).strip()
def norm(s):return re.sub(r'[^a-z0-9äöüß]','',unicodedata.normalize('NFKC',s.lower()))
source=json.loads((ROOT/'data/raw/questions-source.json').read_text())
lookup={norm(q['question']):q for q in source}
html=(ROOT/'data/raw/official-catalogue.html').read_text(encoding='latin1')
parts=re.split(r'<dt>(\d+)\.</dt>',html)
questions=[];mismatches=[]
for i in range(1,len(parts),2):
    index=(i-1)//2
    if not(index<300 or 320<=index<330):continue
    official_id=parts[i];chunk=parts[i+1]
    t=plain(chunk).split('Teil II')[0]
    tokens=re.split('[□☐]',t)
    if len(tokens)!=5:raise ValueError(f'Cannot parse official question {index}: {tokens}')
    question=tokens[0].strip();answers=[x.strip() for x in tokens[1:]]
    if index==329:answers[-1]=answers[-1].split('Fragen für')[0].strip()
    q=lookup.get(norm(question));correct=None
    if q and q.get('solution') in ('a','b','c','d'):
        matched=[j for j,v in enumerate(answers) if norm(v)==norm(q[q['solution']])]
        if len(matched)==1:correct=matched[0]
    images=re.findall(r'<img\s+src=[\'\"]([^\'\"]+)',chunk)
    images=[x for x in images if 'normengrafiken' in x]
    record={'id':('BE-' if index>=300 else '')+official_id,'question':question,'options':answers,'correct':correct,'region':'Berlin' if index>=300 else 'national','images':images}
    questions.append(record)
    if correct is None:mismatches.append(record['id'])
assert len(questions)==310
eligible=[q for q in questions if q['correct'] is not None and not q['images']]
rng=random.Random(260914)
national=[q for q in eligible if q['region']=='national'];berlin=[q for q in eligible if q['region']=='Berlin']
selected=rng.sample(national,30)+rng.sample(berlin,3)
rng.shuffle(selected)
out=ROOT/'data/cache';out.mkdir(exist_ok=True)
(out/'answer-key.json').write_text(json.dumps({q['id']:q['correct'] for q in selected},ensure_ascii=False))
(out/'exam-input.json').write_text(json.dumps([{k:v for k,v in q.items() if k!='correct'} for q in selected],ensure_ascii=False))
(ROOT/'dist/data/questions.json').write_text(json.dumps(questions,ensure_ascii=False,separators=(',',':')))
(ROOT/'dist/data/question-provenance.json').write_text(json.dumps({'wording_source':'https://www.gesetze-im-internet.de/einbtestv/anlage_1.html','catalogue_sha256':hashlib.sha256((ROOT/'data/raw/official-catalogue.html').read_bytes()).hexdigest(),'key_source':'https://github.com/leben-in-deutschland/leben-in-deutschland-scrapper','key_sha256':hashlib.sha256((ROOT/'data/raw/questions-source.json').read_bytes()).hexdigest(),'key_matching':'Normalized German question and correct-answer text; original official option order retained. Secondary keys, not BAMF-certified scoring.','catalogue_questions':len(questions),'eligible_national_text_questions':len(national),'eligible_berlin_text_questions':len(berlin),'unmatched_key_ids':mismatches,'sitting':'Fixed-seed practice selection of 30 national and 3 Berlin text-only items with matched keys. Not an official examination form.','seed':260914},ensure_ascii=False,indent=2))
print(json.dumps({'questions':len(questions),'eligible_national':len(national),'eligible_berlin':len(berlin),'unmatched_keys':mismatches,'selected':[q['id'] for q in selected],'berlin':questions[300:]},ensure_ascii=False),flush=True)
