(function(root){
'use strict';
const exam=root.COACH_EXAM_DATA;
const ids={rm:'1r1QGJSpKrpuvDAEnkwnfeJHvZLZRyb-L',qab:'1FKlOqcZM_8ZdwHbkdqfiRK3Hmj9hpikH',mc:'1dIXqiJ0ehEi4bprasZwB9LlurVFukw5e',ms2:'1gZll6bbC_LgSrdGIpjE0FYePqtVFrJWW',ms3:'1-7fG6VrdBKpsCBbCJZspPyHCINPIwATL'};
const reference=(s,id)=>({...s,fileId:id,url:'https://drive.google.com/file/d/'+id+'/view'});
for(const p of exam.passages)Object.assign(p,{year:2024,genre:'modern',examType:'HKDSE',verified:true});
for(const q of exam.questions){q.year=2024;q.provenance={examType:'HKDSE',language:'modern',status:'ready',checkedAt:'2026-10-10',version:'2024-verified-v1'};q.source.passage=reference(exam.sources[0],ids.rm);q.source.question=reference(q.source.question,ids.qab);q.source.answer=reference(q.source.answer,q.source.answer.name.includes('客觀')?ids.mc:q.source.answer.name.includes('第二')?ids.ms2:ids.ms3);}
})(window);
