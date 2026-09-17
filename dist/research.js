const $=s=>document.querySelector(s);
let estimates=null;
function update(){
  if(!estimates)return;
  const raw=Number($('#epochs').value),epochs=Math.max(1,Math.min(10000,Number.isFinite(raw)?raw:100));
  const bank=Number($('#bank').value),multiplier=Number($('#overhead').value);
  const runtime=$('#runtime').value==='quiet'?estimates.quiet_seconds_per_example:estimates.busy_seconds_per_simulated_second;
  const hours=bank*epochs*runtime*multiplier/3600;
  $('#computeTime').textContent=hours<1?`${(hours*60).toFixed(1)} minutes`:`${hours.toLocaleString('en-US',{maximumFractionDigits:1})} hours`;
  $('#computeExamples').textContent=`${(bank*epochs).toLocaleString('en-US')} one-second neural examples`;
  $('#computeFormula').textContent=`${bank} × ${epochs} × ${runtime.toFixed(4)} s × ${multiplier} ÷ 3,600`;
}
fetch('./data/research-estimates.json').then(r=>{if(!r.ok)throw Error('Unavailable');return r.json();}).then(data=>{estimates=data;update();}).catch(()=>{$('#computeTime').textContent='Estimate unavailable';$('#computeExamples').textContent='The fixed scenarios below remain readable.';});
for(const input of document.querySelectorAll('.inputs input,.inputs select'))input.addEventListener('input',update);
