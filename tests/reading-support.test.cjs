const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const w={window:{}};vm.createContext(w);for(const file of ['reading-support','dse2024-classical-data'])vm.runInContext(fs.readFileSync(__dirname+'/../dist/'+file+'.js','utf8'),w);
const R=w.window.ReadingCoachReadingSupport,passage=w.window.COACH_DSE2024_CLASSICAL_DATA.passages[0];
const original=html=>html.replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
test('every teaching word can be highlighted without altering source text, original note numbers or question bolding',()=>{
 passage.paragraphs.forEach((text,i)=>{const support=passage.readingSupport[i],html=R.sourceHTML(text,passage.paragraphHighlights[i],support.words,i+1);assert.equal(original(html),text);assert.equal((html.match(/class="reading-word"/g)||[]).length,support.words.length);for(const word of support.words)assert.ok(html.includes(word.term+'：顯示詞解'));});
 const second=R.sourceHTML(passage.paragraphs[1],[],passage.readingSupport[1].words,2);assert.match(second,/>以鍤⑤自隨<\/button>/);
 const first=R.sourceHTML(passage.paragraphs[0],passage.paragraphHighlights[0],passage.readingSupport[0].words,1);assert.equal(original(first.match(/<strong>(.*?)<\/strong>/)[1]),'冰欲報卒，適其所願');
});
test('disabled reading support preserves original text and original bolding without word controls',()=>{
 passage.paragraphs.forEach((text,i)=>{const html=R.sourceHTML(text,passage.paragraphHighlights[i],[],i+1);assert.equal(original(html),text);assert.doesNotMatch(html,/reading-word|顯示詞解/);});
});
test('translation disclosure contains only the translation and no word list or word explanations',()=>{
 for(const support of passage.readingSupport){const html=R.translationHTML({label:support.number===1?'第一則':'第二則',support});assert.match(html,/白話語譯/);assert.ok(html.includes(support.translation));assert.doesNotMatch(html,/classical-glossary|字詞與句意| open/);for(const word of support.words)assert.equal(html.includes(word.meaning),false);}
 assert.equal(R.translationHTML({number:1}), '');
});
test('word matching prefers a full term, preserves repeated terms, and treats regex metacharacters as literal text',()=>{
 const words=[{term:'達',meaning:'a'},{term:'為達',meaning:'b'},{term:'a+b',meaning:'c'}],text='為達；達；為達；a+b。',html=R.sourceHTML(text,[],words,2);assert.equal(original(html),text);assert.equal((html.match(/data-reading-word="1"/g)||[]).length,2);assert.equal((html.match(/data-reading-word="2"/g)||[]).length,1);assert.equal((html.match(/data-reading-word="0"/g)||[]).length,1);
});
test('original text and translation escape markup while word meanings are not embedded in source HTML',()=>{
 const html=R.sourceHTML('<img>詞&義',[],[{term:'詞&義',meaning:'不能提早呈現的詞解'}],1);assert.equal(original(html),'<img>詞&義');assert.doesNotMatch(html,/<img>|不能提早呈現/);assert.ok(html.includes('&lt;img&gt;'));assert.ok(R.translationHTML({label:'第一則',support:{translation:'<script> &'}}).includes('&lt;script&gt; &amp;'));
});
test('original paper notes provide six independent controls even when teaching analysis is disabled',()=>{
 const notes=R.sourceNotes(passage.notes);assert.equal(notes.length,6);assert.deepEqual(Array.from(notes,n=>[n.marker,n.term]),[['①','蘇峻亂'],['②','庾冰時為吳郡'],['③','蘧篨'],['④','劉伯倫'],['⑤','鍤'],['⑥','衣衾']]);
 const html=passage.paragraphs.map((text,i)=>{const html=R.sourceHTML(text,passage.paragraphHighlights[i],[],i+1,passage.notes);assert.equal(original(html),text);assert.doesNotMatch(html,/data-reading-word=/);return html;}).join('');
 assert.equal((html.match(/class="reading-word source-note-word"/g)||[]).length,6);for(const n of notes)assert.ok(html.includes('data-source-note="'+n.index+'"'));assert.match(html,/>鍤⑤<\/button>/);assert.match(html,/>衣衾⑥<\/button>/);
});
test('teaching phrase controls preserve original-note access without nested buttons or losing note markers',()=>{
 const html=passage.paragraphs.map((text,i)=>R.sourceHTML(text,passage.paragraphHighlights[i],passage.readingSupport[i].words,i+1,passage.notes)).join('');assert.equal((html.match(/data-reading-word=/g)||[]).length,14);assert.equal((html.match(/data-source-note=/g)||[]).length,6);assert.equal((html.match(/<button /g)||[]).length,17);assert.doesNotMatch(html,/<button[^>]*>[^<]*<button/);
 assert.match(html,/<button[^>]*data-reading-word="0"[^>]*data-source-note="4"[^>]*>以鍤⑤自隨<\/button>/);assert.match(html,/<button[^>]*data-reading-word="1"[^>]*data-source-note="5"[^>]*>棺槨衣衾⑥<\/button>/);
});
test('a paper note with a different heading still works through its original note number without guessing text',()=>{
 const text='一夜風雨①。',notes=['① 風雨欲來：原卷提供的解說。'],html=R.sourceHTML(text,[],[],1,notes);assert.equal(original(html),text);assert.match(html,/>①<\/button>/);assert.match(html,/data-source-note="0"/);assert.doesNotMatch(html,/data-reading-word=/);
 assert.deepEqual(Array.from(R.sourceNotes(['不含編號的其他原註釋'])),[]);
});
