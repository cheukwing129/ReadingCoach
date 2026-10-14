(function(root){
'use strict';
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const regexp=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function sourceHTML(text,highlights=[],words=[],number){
 const entries=words.map((word,index)=>({...word,index})).filter(word=>word.term).sort((a,b)=>b.term.length-a.term.length);
 const pattern=entries.length?new RegExp(entries.map(word=>Array.from(word.term).map(regexp).join('[①-⑳]*')).join('|'),'g'):null;
 function annotate(part){
  if(!pattern)return escape(part);
  let html='',end=0;pattern.lastIndex=0;
  for(const match of part.matchAll(pattern)){
   const word=entries.find(word=>word.term===match[0].replace(/[①-⑳]/g,''));
   html+=escape(part.slice(end,match.index))+'<button type="button" class="reading-word" data-reading-word="'+word.index+'" data-reading-paragraph="'+number+'" aria-label="'+escape(word.term)+'：顯示詞解" aria-haspopup="dialog" aria-expanded="false">'+escape(match[0])+'</button>';end=match.index+match[0].length;
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
  const paragraph=getArticle()?.paragraphs.find(p=>p.number===Number(button.dataset.readingParagraph)),word=paragraph?.support?.words[Number(button.dataset.readingWord)];
  if(!word)return;close();
  if(!popup){
   popup=document.createElement('div');popup.id='reading-word-popup';popup.className='reading-word-popup';popup.hidden=true;popup.setAttribute('role','dialog');popup.setAttribute('aria-modal','false');popup.setAttribute('aria-labelledby','reading-word-title');popup.setAttribute('aria-describedby','reading-word-meaning');
   popup.innerHTML='<div class="reading-word-heading"><h3 id="reading-word-title"></h3><button type="button" class="reading-word-close" aria-label="關閉詞解">×</button></div><p id="reading-word-meaning"></p>';document.body.append(popup);
   popup.querySelector('button').addEventListener('click',()=>close(true));
  }
  popup.querySelector('h3').textContent=word.term;popup.querySelector('p').textContent=word.meaning;
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
root.ReadingCoachReadingSupport={sourceHTML,translationHTML,bind};
})(window);
