'use strict';
// Source-aware localization keeps live numeric values and user-entered names intact.
// The same translation catalog is used by the Python response formatter.
const I18n = (() => {
  let language = 'vi';
  try { const saved=localStorage.getItem('k305-language'); if(['vi','en','de'].includes(saved)) language=saved; } catch {}
  let catalog=[], patterns=[];
  const originals=new WeakMap(), attributes=new WeakMap();
  const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function translate(text,depth=0){
    if(language==='vi'||typeof text!=='string'||depth>2)return text;
    const source=text.trim(), column=language==='en'?1:2;
    const exact=catalog.find(row=>row[0]===source);
    let translated=exact?.[column];
    if(translated===undefined){
      for(const item of patterns){
        const match=source.match(item.regex);
        if(!match)continue;
        const values=Object.fromEntries(item.keys.map((key,i)=>[key,match[i+1]]));
        translated=item.row[column].replace(/\{(\w+)\}/g,(_,key)=>['label','type','mode'].includes(key)?translate(values[key],depth+1):values[key]);
        break;
      }
    }
    return translated===undefined?text:text.slice(0,text.indexOf(source))+translated+text.slice(text.indexOf(source)+source.length);
  }
  function apply(root=document.body){
    if(!root)return;
    const nodes=[];
    if(root.nodeType===Node.TEXT_NODE)nodes.push(root);
    else {const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode())nodes.push(walker.currentNode);}
    for(const node of nodes){
      if(!node.parentElement||node.parentElement.closest('script,style,[data-no-translate]'))continue;
      const old=originals.get(node),current=node.nodeValue;
      const source=old&&current===old.rendered?old.source:current;
      const rendered=translate(source);
      originals.set(node,{source,rendered});
      if(current!==rendered)node.nodeValue=rendered;
    }
    const elements=root.nodeType===Node.ELEMENT_NODE?[root,...root.querySelectorAll('[title],[aria-label],[placeholder]')]:[];
    for(const el of elements){
      if(el.closest('[data-no-translate]'))continue;
      const cache=attributes.get(el)||{};
      for(const name of ['title','aria-label','placeholder']){
        if(!el.hasAttribute(name))continue;
        const current=el.getAttribute(name),old=cache[name],source=old&&current===old.rendered?old.source:current,rendered=translate(source);
        cache[name]={source,rendered};if(current!==rendered)el.setAttribute(name,rendered);
      }
      attributes.set(el,cache);
    }
  }
  const ready=fetch('/locales.json').then(r=>{if(!r.ok)throw Error('Unable to load language catalog');return r.json();}).then(rows=>{
    catalog=rows;
    patterns=rows.filter(row=>row[0].includes('{')).map(row=>{
      const keys=[];let start=0,pattern='';
      for(const m of row[0].matchAll(/\{(\w+)\}/g)){pattern+=escapeRegex(row[0].slice(start,m.index))+'(.+?)';keys.push(m[1]);start=m.index+m[0].length;}
      return {row,keys,regex:new RegExp('^'+pattern+escapeRegex(row[0].slice(start))+'$')};
    });
    document.documentElement.lang=language;
    document.getElementById('language').value=language;
    apply();
    // Localize only changed subtrees, not the entire page on every replay frame.
    new MutationObserver(records=>{
      const roots=new Set();
      for(const record of records){if(record.type==='childList')for(const node of record.addedNodes)roots.add(node);else roots.add(record.target);}
      for(const root of roots)if(root.isConnected)apply(root);
    }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder','title']});
  });
  return {ready,translate,apply,get language(){return language;},setLanguage(value){
    if(!['vi','en','de'].includes(value))return;
    language=value;document.documentElement.lang=value;
    try{localStorage.setItem('k305-language',value);}catch{}
    apply();
  }};
})();
