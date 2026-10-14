(function(root){
'use strict';
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const regexp=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function sourceNotes(notes=[]){
 return notes.flatMap((text,index)=>{const match=text.match(/^\s*([①-⑳])\s*([^：:]+)[：:]\s*([\s\S]+)$/);return match?[{index,marker:match[1],term:match[2].trim(),meaning:match[3].trim()}]:[];});
}
function sourceHTML(text,highlights=[],words=[],number,notes=[]){
 const entries=words.map((word,index)=>({...word,index})).filter(word=>word.term),original=sourceNotes(notes);
 const patterns=[...entries.map(word=>({term:word.term,pattern:Array.from(word.term).map(regexp).join('[①-⑳]*')+'[①-⑳]*'})),...original.map(note=>({term:note.term,pattern:regexp(note.term)+regexp(note.marker)}))].sort((a,b)=>b.term.length-a.term.length).map(word=>word.pattern);
 patterns.push(...original.map(note=>regexp(note.marker)));
 const pattern=patterns.length?new RegExp(patterns.join('|'),'g'):null;
 function annotate(part){
  if(!pattern)return escape(part);
  let html='',end=0;pattern.lastIndex=0;
  for(const match of part.matchAll(pattern)){
   const word=entries.find(word=>word.term===match[0].replace(/[①-⑳]/g,'')),note=original.find(note=>match[0].includes(note.marker)),label=word?.term||note.term;
   html+=escape(part.slice(end,match.index))+'<button type="button" class="reading-word'+(note?' source-note-word':'')+'"'+(word?' data-reading-word="'+word.index+'"':'')+(note?' data-source-note="'+note.index+'"':'')+' data-reading-paragraph="'+number+'" aria-label="'+escape(label)+(note&&!word?'：原卷註釋':'：顯示詞解')+'" aria-haspopup="dialog" aria-expanded="false">'+escape(match[0])+'</button>';end=match.index+match[0].length;
  }
  return html+escape(part.slice(end));
 }
 let html='',remaining=text;
 while(remaining){
  const next=highlights.filter(word=>word).map(word=>({word,index:remaining.indexOf(word)})).filter(match=>match.index>=0).sort((a,b)=>a.index-b.index||b.word.length-a.word.length)[0];
  if(!next){html+=annotate(remaining);break;}
  html+=annotate(remaining.slice(0,next.index))+'<strong>'+annotate(next.word)+'</strong>';remaining=remaining.slice(next.index+next.word.length);
 }
 return html;
}
function translationHTML(paragraph){
 return paragraph.support?'<details class="classical-help"><summary>'+escape(paragraph.label||'本段')+'白話語譯</summary><div class="classical-help-body"><p class="classical-translation">'+escape(paragraph.support.translation)+'</p></div></details>':'';
}
function bind(main,getArticle){
 let popup=null,trigger=null;
 function position(){
  const viewport=window.visualViewport,viewLeft=viewport?.offsetLeft||0,viewTop=viewport?.offsetTop||0,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight,gap=12,rect=trigger.getBoundingClientRect();
  popup.style.width=Math.min(336,width-gap*2)+'px';popup.style.maxHeight=Math.max(0,height-gap*2)+'px';
  const size=popup.getBoundingClientRect();
  popup.style.left=Math.max(viewLeft+gap,Math.min(rect.left,viewLeft+width-size.width-gap))+'px';
  const below=rect.bottom+gap,above=rect.top-size.height-gap;
  popup.style.top=Math.max(viewTop+gap,Math.min(below+size.height<=viewTop+height-gap?below:above,viewTop+height-size.height-gap))+'px';
 }
 function close(restoreFocus=false){
  if(!trigger)return;
  const previous=trigger;trigger=null;popup.hidden=true;previous.setAttribute('aria-expanded','false');
  if(restoreFocus&&previous.isConnected)previous.focus({preventScroll:true});
 }
 function show(button){
  if(trigger===button){close(true);return;}
  const article=getArticle(),paragraph=article?.paragraphs.find(p=>p.number===Number(button.dataset.readingParagraph)),word=button.dataset.readingWord===undefined?null:paragraph?.support?.words[Number(button.dataset.readingWord)],note=button.dataset.sourceNote===undefined?null:sourceNotes(article?.notes).find(note=>note.index===Number(button.dataset.sourceNote)),entry=word||note;
  if(!entry)return;close();
  if(!popup){
   popup=document.createElement('div');popup.id='reading-word-popup';popup.className='reading-word-popup';popup.hidden=true;popup.setAttribute('role','dialog');popup.setAttribute('aria-modal','false');popup.setAttribute('aria-labelledby','reading-word-title');popup.setAttribute('aria-describedby','reading-word-meaning');
   popup.innerHTML='<div class="reading-word-heading"><h3 id="reading-word-title"></h3><button type="button" class="reading-word-close" aria-label="關閉詞解">×</button></div><p id="reading-word-meaning"></p>';document.body.append(popup);
   popup.querySelector('button').addEventListener('click',()=>close(true));
  }
  popup.querySelector('h3').textContent=entry.term;popup.querySelector('p').textContent=word&&note?'原卷註釋（'+note.term+'）：'+note.meaning+'\n\n字詞解說：'+word.meaning:entry.meaning;
  popup.hidden=false;trigger=button;position();trigger.setAttribute('aria-controls','reading-word-popup');trigger.setAttribute('aria-expanded','true');popup.querySelector('button').focus({preventScroll:true});
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('.reading-word');
  if(button&&main.contains(button)){show(button);return;}
  if(trigger&&!popup.contains(event.target))close();
 });
 document.addEventListener('keydown',event=>{if(trigger&&event.key==='Escape'){event.preventDefault();close(true);}});
 document.addEventListener('focusin',event=>{if(trigger&&!popup.contains(event.target)&&event.target!==trigger)close();});
 document.addEventListener('scroll',event=>{if(trigger&&!popup.contains(event.target))position();},true);
 window.addEventListener('resize',()=>close());
 window.visualViewport?.addEventListener('resize',()=>close());
 return {close};
}
root.ReadingCoachReadingSupport={sourceHTML,sourceNotes,translationHTML,bind};
})(window);
