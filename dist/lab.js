const $=s=>document.querySelector(s);
let share=null;
const resolve=s=>s.replaceAll('{{DEMO_URL}}',location.origin+'/lab.html');
async function copy(text,label){
  try{await navigator.clipboard.writeText(text);$('#copyStatus').textContent=label+' copied.';}
  catch{
    let fallback=$('#copyFallback');
    if(!fallback){fallback=document.createElement('textarea');fallback.id='copyFallback';fallback.readOnly=true;fallback.setAttribute('aria-label','Draft ready to copy');$('#copyStatus').after(fallback);}
    fallback.value=text;fallback.focus();fallback.select();
    $('#copyStatus').textContent='Automatic copy is unavailable here. The draft is selected below; copy it or use the download.';
  }
}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);$('#copyStatus').textContent='Download requested. If it does not appear, open the draft below or use Copy.';}
function thread(){return share.thread.map((s,i)=>`${i+1}/${share.thread.length}\n${resolve(s)}`).join('\n\n---\n\n');}
fetch('./share-content.json').then(r=>{if(!r.ok)throw Error('Unavailable');return r.json();}).then(data=>{
  share=data;
  for(const [i,s] of share.thread.entries()){const article=document.createElement('article'),number=document.createElement('span'),p=document.createElement('p');number.textContent=`${i+1}/${share.thread.length}`;p.textContent=resolve(s);article.append(number,p);$('#threadPreview').append(article);}
  $('#storyPreview').textContent=resolve(share.story);
}).catch(()=>{$('#copyStatus').textContent='The post drafts could not load. The video, figures and source downloads remain available.';});
$('#copyThread').addEventListener('click',()=>share&&copy(thread(),'Thread'));
$('#copyPost').addEventListener('click',()=>share&&copy(resolve(share.thread[0]),'Opening post'));
$('#downloadThread').addEventListener('click',()=>share&&download(thread(),'FLY-X-thread.md'));
$('#downloadStory').addEventListener('click',()=>share&&download(resolve(share.story),'FLY-X-longer-story.md'));
const evidence={
  map:['PUBLISHED ANATOMY','MaleCNS connectome','The released reconstruction provides anatomical connectivity and neuron geometry. It does not supply a citizenship learner or uniquely determine neural dynamics.','https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/'],
  model:['OUR ASSUMPTIONS','Computational model','The full retained graph runs custom leaky integrate-and-fire dynamics. Cell gains, sensory mapping, fixed output labels and supervised local plasticity are engineering assumptions. Biological fidelity has not been validated.','SOURCE-ALIGNMENT.md'],
  vision:['CALIBRATION RECORDS','Retinal input','We varied retinal drive, memory excitability, coverage, output selection and relay currents. All 22 configurations are reported. None met the predeclared visual admission criteria.','data/study-002/protocol.md'],
  control:['PROSPECTIVE POSITIVE CONTROL','Direct neural stimulation','Four disjoint groups of 16 visual Kenyon cells receive direct current. This bypasses the unresolved sensory route to test learning. Only existing KC-to-output connection weights can change.','data/study-002/plasticity-control.json'],
  gate:['OPEN RESEARCH GATE','Visual learning remains unresolved','No configuration qualified for visual training. The separate original 33-question practice baseline scored 0/33. Learning four directly stimulated patterns cannot authorize citizenship training.','data/study-002/summary.json'],
  result:['MEASURED, THEN REPLICATED','A first learning result','First ensembles: 9/32 untrained, 32/32 trained, 8/32 shuffled labels. New ensembles: 8/32, 30/32, 0/32. Saved-weight replay, weight reset and Kenyon-cell silencing checks are published. These are lab trials, not citizenship questions.','data/study-002/verification.json']
};
document.querySelectorAll('[data-evidence]').forEach(button=>button.addEventListener('click',()=>{
  const [type,title,text,url]=evidence[button.dataset.evidence];
  document.querySelectorAll('[data-evidence]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  $('#evidenceType').textContent=type;$('#evidenceTitle').textContent=title;$('#evidenceText').textContent=text;$('#evidenceSource').href=url;
}));
