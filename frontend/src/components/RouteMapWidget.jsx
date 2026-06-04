import React from 'react';
const CC = { ZA:{x:210,y:255}, ZW:{x:235,y:195}, ZM:{x:220,y:155}, BW:{x:195,y:220}, NA:{x:155,y:220}, MZ:{x:270,y:195}, TZ:{x:270,y:130}, MU:{x:330,y:210}, LS:{x:225,y:270}, SZ:{x:250,y:265}, MW:{x:260,y:165}, AO:{x:155,y:130}, CD:{x:195,y:110}, MG:{x:305,y:195}, KE:{x:275,y:85} };
export default function RouteMapWidget({ originIso, destinationIso, originCity, destinationCity }) {
  const o = CC[originIso], d = CC[destinationIso];
  if (!o || !d) return null;
  const mx = (o.x+d.x)/2, my = Math.min(o.y,d.y)-40;
  return (
    <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(184,150,46,0.2)', borderRadius:10, overflow:'hidden', marginTop:16 }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(184,150,46,0.1)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:11, color:'#b8962e', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em' }}>Route</span>
        <span style={{ fontSize:13, color:'#e8e0d0' }}>{originCity||originIso} → {destinationCity||destinationIso}</span>
      </div>
      <svg viewBox="120 60 230 240" style={{ width:'100%', maxHeight:200, display:'block' }}>
        <rect x="120" y="60" width="230" height="240" fill="#0d0f13" />
        {Object.entries(CC).map(([iso,c]) => (<circle key={iso} cx={c.x} cy={c.y} r={iso===originIso||iso===destinationIso?6:2} fill={iso===originIso?'#b8962e':iso===destinationIso?'#22c55e':'rgba(255,255,255,0.15)'} />))}
        <path d={`M${o.x},${o.y} Q${mx},${my} ${d.x},${d.y}`} fill="none" stroke="#b8962e" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.9" />
        <text x={o.x} y={o.y-10} textAnchor="middle" fill="#b8962e" fontSize="7" fontWeight="600">{originCity||originIso}</text>
        <text x={d.x} y={d.y-10} textAnchor="middle" fill="#22c55e" fontSize="7" fontWeight="600">{destinationCity||destinationIso}</text>
      </svg>
      <div style={{ padding:'8px 14px', display:'flex', gap:16, fontSize:11, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#b8962e', display:'inline-block' }} /><span style={{ color:'rgba(232,224,208,0.6)' }}>Origin: {originCity||originIso}</span></span>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', display:'inline-block' }} /><span style={{ color:'rgba(232,224,208,0.6)' }}>Dest: {destinationCity||destinationIso}</span></span>
      </div>
    </div>
  );
}
