(function(){
  'use strict';
  const config = window.COACH_YEAR_ACCESS_CONFIG || {years:{},teacher:''};
  const storageKey = 'readingcoach-year-access-v1';
  const emptyState = () => ({version:1,teacherHash:'',years:{}});
  function restore(){
    try{
      const value=JSON.parse(localStorage.getItem(storageKey)||'null');
      if(value?.version!==1)return emptyState();
      const years={};
      if(value.years&&typeof value.years==='object'&&!Array.isArray(value.years)){
        for(const [year,hash] of Object.entries(value.years))if(/^\d{4}$/.test(year)&&typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash))years[year]=hash;
      }
      return {version:1,teacherHash:typeof value.teacherHash==='string'?value.teacherHash:'',years};
    }catch{return emptyState();}
  }
  let state=restore();
  function isUnlocked(year){
    const key=String(Number(year));
    return Boolean((config.teacher&&state.teacherHash===config.teacher)||(config.years[key]&&state.years[key]===config.years[key]));
  }
  async function hashPassword(password){
    if(!window.crypto?.subtle||typeof TextEncoder==='undefined')throw new Error('Secure password hashing is unavailable.');
    const bytes=new TextEncoder().encode(String(password));
    const digest=await window.crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  function remember(){try{localStorage.setItem(storageKey,JSON.stringify(state));return true;}catch{return false;}}
  async function unlock(year,password){
    const numericYear=Number(year),key=String(numericYear),candidate=await hashPassword(password);
    if(candidate===config.teacher){state={...state,version:1,teacherHash:config.teacher};return{ok:true,teacher:true,remembered:remember()};}
    if(candidate!==config.years[key])return{ok:false,teacher:false,remembered:false};
    state={...state,version:1,years:{...state.years,[key]:config.years[key]}};
    return{ok:true,teacher:false,remembered:remember()};
  }
  window.ReadingCoachYearAccess=Object.freeze({isUnlocked,unlock,storageKey});
})();
