/** Extract a pasted HTTP(S) link without re-encoding signed query parameters. */
export function cleanLinkParameter(value: string, name = ''): string {
 const protectedNames = new Set(['key','apikey','xapikey','authorization','token','accesstoken','refreshtoken','password','secret','secretkey','sign','signature','nonce']);
 if (protectedNames.has(name.toLowerCase().replace(/[_\- ]/g, ''))) return value;
 const text=value.trim();
 if(text.startsWith('{')||text.startsWith('[')){try{JSON.parse(text);return value;}catch{/* Not structured JSON. */}}
 const pattern=/https?:\/\/[^\s<>"'`，。；！？、…“”【】（）]+/gi;
 for(const match of value.matchAll(pattern)){
  let candidate=match[0];
  for(const [open,close]of [['(',')'],['[',']'],['{','}']] as const){while(candidate.endsWith(close)&&candidate.split(close).length>candidate.split(open).length)candidate=candidate.slice(0,-1);}
  if(!/[?#]/.test(candidate))candidate=candidate.replace(/[.,;!]+$/,'');
  if(/%(?![\da-f]{2})/i.test(candidate))continue;
  try{const parsed=new URL(candidate);if(parsed.hostname&&!parsed.username&&!parsed.password&&!candidate.includes('\\'))return candidate;}catch{/* Try the next valid link, otherwise preserve text. */}
 }
 return value;
}