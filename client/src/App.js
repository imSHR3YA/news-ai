import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Masonry from 'react-masonry-css';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, updateProfile,
} from 'firebase/auth';
import {
  collection, addDoc, query, where, orderBy,
  onSnapshot, serverTimestamp, doc, setDoc, getDoc,
} from 'firebase/firestore';
import { auth, googleProvider, db, isFirebaseEnabled } from './firebase';
import { useAuth } from './AuthContext';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// ══ CONSTANTS ═══════════════════════════════════════════════════════════════
const CATS = ['All', 'Sports', 'Business', 'Health', 'Entertainment', 'Technology', 'Science'];
const LANGUAGES = ['Hindi','Tamil','Telugu','Bengali','Marathi','Kannada','Spanish','French','German','Arabic','Chinese','Japanese'];
const BREAKPOINTS = { default: 3, 1100: 2, 700: 1 };

// ══ HELPERS ══════════════════════════════════════════════════════════════════
const readTime = (t='') => `${Math.max(1,Math.round(t.split(' ').length/200))} min read`;
const diffLevel = (t='') => { const avg=t.split('. ').reduce((a,s)=>a+s.split(' ').length,0)/Math.max(1,t.split('. ').length); return avg<12?'Easy':avg<20?'Medium':'Advanced'; };
const timeAgo = (d) => { try { return formatDistanceToNow(new Date(d),{addSuffix:true}); } catch { return ''; } };
const commentTimeAgo = (ts) => {
  if(!ts) return 'just now';
  try {
    const time = typeof ts === 'string' ? new Date(ts).getTime() : ts.toDate().getTime();
    const diff=(Date.now()-time)/1000;
    if(diff<60)return 'just now';
    if(diff<3600)return`${Math.floor(diff/60)}m ago`;
    if(diff<86400)return`${Math.floor(diff/3600)}h ago`;
    return`${Math.floor(diff/86400)}d ago`;
  } catch { return ''; }
};
const docId = (url) => btoa(encodeURIComponent(url)).replace(/[^a-zA-Z0-9]/g,'').slice(0,40);
const textValue = (value, fallback='') => {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') return value.summary || value.explanation || value.translated || value.reason || value.note || fallback;
  return fallback;
};
const getYoutubeId = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
  return match ? match[1] : null;
};

const getSavedArticles = () => JSON.parse(localStorage.getItem('savedArticles')||'[]');
const setSavedArticles = (articles) => {
  localStorage.setItem('savedArticles', JSON.stringify(articles));
  window.dispatchEvent(new Event('savedArticlesChanged'));
};
const uniqueArticles = (items=[]) => {
  const seen = new Set();
  return items.filter(article => {
    const key = (article.url || article.title || '').trim().toLowerCase();
    if(!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
async function shareArticle(article) {
  try {
    if (navigator.share) {
      await navigator.share({ title:article.title, text:article.description||'', url:article.url });
      return;
    }
    await navigator.clipboard.writeText(article.url);
    toast.success('Link copied!');
  } catch {
    toast.error('Could not share this article');
  }
}

// ══ AUTH PAGE ════════════════════════════════════════════════════════════════
function AuthPage() {
  const { demoLogin } = useAuth();
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ name:'', email:'', password:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const onChange = e => setForm(f=>({...f,[e.target.name]:e.target.value}));

  async function handleGoogle() {
    setLoading(true); setError('');
    try {
      if (!isFirebaseEnabled) {
        demoLogin({ email:'demo@newsai.local', displayName:'NewsAI Demo' });
        toast.success('Demo mode enabled! 🎉');
      } else {
        await signInWithPopup(auth, googleProvider);
        toast.success('Welcome! 🎉');
      }
    }
    catch(e) { setError(e.message.replace('Firebase: ','')); }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError('');
    if (!form.email||!form.password) { setError('Please fill all fields'); return; }
    if (mode==='signup'&&!form.name) { setError('Please enter your name'); return; }
    if (form.password.length<6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      if (!isFirebaseEnabled) {
        demoLogin({ email:form.email, displayName:form.name||form.email.split('@')[0] });
        toast.success(mode==='signup'?'Demo account created! 🎉':'Welcome back in demo mode! 👋');
      } else if (mode==='signup') {
        const c = await createUserWithEmailAndPassword(auth,form.email,form.password);
        await updateProfile(c.user,{displayName:form.name});
        toast.success('Account created! Welcome 🎉');
      } else {
        await signInWithEmailAndPassword(auth,form.email,form.password);
        toast.success('Welcome back! 👋');
      }
    } catch(e) {
      setError(e.message.replace('Firebase: ',''));
    }
    setLoading(false);
  }

  return (
    <div className="auth-bg">
      <div className="auth-left">
        <div className="auth-left-inner">
          <div className="auth-logo"><img src="/logo.png" alt="" style={{height:40}}/>News<span className="auth-logo-ai">AI</span></div>
          <h2 className="auth-tagline">Your AI-Powered<br/>News Universe</h2>
          <p className="auth-subtagline">Sign in to unlock the full NewsAI experience — personalized, intelligent, and real-time.</p>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          <h1 className="auth-card-title">{mode==='signin'?'Welcome back':'Create account'}</h1>
          <p className="auth-card-sub">{mode==='signin'?'Sign in to your NewsAI account':'Join NewsAI for free today'}</p>

          <button className="auth-google-btn" onClick={handleGoogle} disabled={loading}>
            Continue with Google
          </button>

          <div className="auth-divider">
            <div className="auth-divider-line"/><span className="auth-divider-text">or</span><div className="auth-divider-line"/>
          </div>

          {error && <div className="auth-error" style={{marginBottom:'1rem'}}>⚠️ {error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode==='signup' && (
              <div className="auth-field">
                <label className="auth-label">Full Name</label>
                <input name="name" type="text" placeholder="John Doe" value={form.name} onChange={onChange} className="auth-input"/>
              </div>
            )}
            <div className="auth-field">
              <label className="auth-label">Email Address</label>
              <input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={onChange} className="auth-input"/>
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <div className="auth-pass-wrap">
                <input name="password" type={showPass?'text':'password'} placeholder="Min 6 characters" value={form.password} onChange={onChange} className="auth-input"/>
                <button type="button" className="auth-eye-btn" onClick={()=>setShowPass(s=>!s)}>{showPass?'🙈':'👁️'}</button>
              </div>
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading?'Please wait...':(mode==='signin'?'Sign In →':'Create Account →')}
            </button>
          </form>

          <p className="auth-switch">
            {mode==='signin'?'Don\'t have an account? ':'Already have an account? '}
            <button className="auth-switch-btn" onClick={()=>{setMode(m=>m==='signin'?'signup':'signin');setError('');setForm({name:'',email:'',password:''});}}>
              {mode==='signin'?'Sign Up':'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ══ USER MENU ════════════════════════════════════════════════════════════════
function UserMenu({ onOpenSuggest, onOpenSaved, onOpenComments, onOpenSuggestions, theme, setTheme }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    const h = e => { if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);
  if (!user) return null;
  const initials = user.displayName?user.displayName.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2):user.email[0].toUpperCase();
  
  return (
    <div className="user-menu-wrap" ref={ref}>
      <button className="user-avatar-btn" onClick={()=>setOpen(o=>!o)} title={user.displayName||user.email}>
        {user.photoURL
          ?<img src={user.photoURL} alt="avatar" className="user-avatar-img"/>
          :<div className="user-avatar-initials">{initials}</div>
        }
      </button>
      {open&&(
        <div className="user-dropdown">
          <div className="user-drop-info">
            {user.photoURL
              ?<img src={user.photoURL} alt="" className="user-drop-avatar"/>
              :<div className="user-drop-avatar" style={{background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:'1rem'}}>{initials}</div>
            }
            <div><div className="user-drop-name">{user.displayName||'User'}</div><div className="user-drop-email">{user.email}</div></div>
          </div>
          <div className="user-drop-divider"/>
          {[
            {icon:'💡',label:'Suggest an Article',action:()=>{onOpenSuggest();setOpen(false);}},
            {icon:'📋',label:'Suggested Articles',action:()=>{onOpenSuggestions();setOpen(false);}},
            {icon:'🔖',label:'My Saved Articles',action:()=>{onOpenSaved();setOpen(false);}},
            {icon:'💬',label:'My Comments',action:()=>{onOpenComments();setOpen(false);}},
          ].map((item,i)=>(
            <button key={i} className="user-drop-item" onClick={item.action}><span>{item.icon}</span>{item.label}</button>
          ))}
          <div className="user-drop-divider"/>
          <button className="user-drop-item" onClick={()=>{setTheme(theme==='light'?'dark':'light');setOpen(false);}}>
            <span>{theme==='light'?'🌙':'☀️'}</span>Toggle Theme
          </button>
          <div className="user-drop-divider"/>
          <button className="user-drop-item danger" onClick={()=>{logout();setOpen(false);}}><span>🚪</span>Sign Out</button>
        </div>
      )}
    </div>
  );
}

// ══ WEATHER WIDGET & LIVE CLOCK ═════════════════════════════════════════════
function WeatherWidget() {
  const [w, setW] = useState(null);
  useEffect(()=>{
    async function byCity() { try { const r=await axios.get('/api/weather?city=Mumbai'); setW(r.data); } catch{} }
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        async pos=>{ try{const r=await axios.get(`/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);setW(r.data);}catch{byCity();} },
        ()=>byCity()
      );
    } else byCity();
  },[]);
  if(!w) return null;
  return (
    <div className="weather-pill">
      <img src={`https://openweathermap.org/img/wn/${w.icon}.png`} alt={w.description} onError={e=>e.target.style.display='none'}/>
      <span>{w.temp}°C</span>
      <span style={{color:'var(--muted)',fontSize:'0.72rem'}}>{w.city}</span>
    </div>
  );
}

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(()=>{ const i=setInterval(()=>setT(new Date()),1000); return()=>clearInterval(i); },[]);
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return <span className="live-clock">{days[t.getDay()]} {months[t.getMonth()]} {t.getDate()} &nbsp;{t.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>;
}

// ══ AI PANEL ══════════════════════════════════════════════════════════════════
function AIPanel({ article }) {
  const [tab, setTab] = useState('summary');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('Hindi');
  const text = article.description||article.title||'';

  async function fetchAI(type) {
    if(data[type]) return;
    setLoading(true);
    try {
      let res;
      if(type==='summary') res=await axios.post('/api/ai/summarize',{text,title:article.title});
      else if(type==='sentiment') res=await axios.post('/api/ai/sentiment',{text});
      else if(type==='credibility') res=await axios.post('/api/ai/credibility',{text,title:article.title,source:article.source});
      else if(type==='eli5') res=await axios.post('/api/ai/eli5',{text,title:article.title});
      else if(type==='tags') res=await axios.post('/api/ai/tags',{text,title:article.title});
      else if(type==='bias') res=await axios.post('/api/ai/bias',{text,title:article.title});
      setData(d=>({...d,[type]:res.data}));
    } catch {}
    setLoading(false);
  }

  async function fetchTranslate() {
    const key=`translate_${lang}`;
    if(data[key]) return;
    setLoading(true);
    try {
      const res=await axios.post('/api/ai/translate',{text:article.title+'. '+text,language:lang});
      setData(d=>({...d,[key]:res.data.translated}));
    } catch {}
    setLoading(false);
  }

  useEffect(()=>{ fetchAI('summary'); },[]);

  const tabs=[
    {id:'summary',label:'📝 Summary'},
    {id:'sentiment',label:'😊 Sentiment'},
    {id:'credibility',label:'✅ Credibility'},
    {id:'bias',label:'⚖️ Bias'},
    {id:'eli5',label:'👶 ELI5'},
    {id:'translate',label:'🌐 Translate'},
    {id:'tags',label:'🏷️ Tags'},
  ];

  const biasColors={'Left':'#3b82f6','Center-Left':'#60a5fa','Center':'#6b7280','Center-Right':'#f97316','Right':'#ef4444'};
  const biasLabels=['Left','Center-Left','Center','Center-Right','Right'];

  return (
    <div className="modal-ai-panel">
      <div className="modal-ai-tabs">
        {tabs.map(t=>(
          <button key={t.id} className={`ai-tab ${tab===t.id?'active':''}`} onClick={()=>{setTab(t.id);if(t.id!=='translate')fetchAI(t.id);}}>
            {t.label}
          </button>
        ))}
      </div>
      {loading && <div className="ai-loading"><div className="spinner"/>Analyzing with AI...</div>}
      {!loading&&tab==='summary'&&data.summary&&<div className="ai-content">{textValue(data.summary)}</div>}
      {!loading&&tab==='sentiment'&&data.sentiment&&(
        <div>
          <div style={{fontSize:'2.2rem',marginBottom:'0.5rem'}}>{data.sentiment.emoji}</div>
          <div style={{fontSize:'1rem',fontWeight:700,color:`var(--${data.sentiment.sentiment==='positive'?'positive':data.sentiment.sentiment==='negative'?'negative':'neutral'})`,marginBottom:'0.5rem',textTransform:'capitalize'}}>
            {data.sentiment.sentiment} · {data.sentiment.score}/100
          </div>
          <div style={{height:8,background:'var(--border)',borderRadius:99,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${data.sentiment.score}%`,background:`var(--${data.sentiment.sentiment==='positive'?'positive':data.sentiment.sentiment==='negative'?'negative':'neutral'})`,borderRadius:99,transition:'width 0.8s ease'}}/>
          </div>
        </div>
      )}
      {!loading&&tab==='credibility'&&data.credibility&&(
        <div>
          <div className="credibility-meter">
            <div className="credibility-bar"><div className="credibility-fill" style={{width:`${data.credibility.score}%`}}/></div>
            <span className="credibility-score">{data.credibility.score}%</span>
          </div>
          <div style={{fontWeight:700,marginBottom:'0.4rem'}}>{data.credibility.label} Credibility</div>
          <div className="ai-content">{textValue(data.credibility.reason)}</div>
        </div>
      )}
      {!loading&&tab==='bias'&&data.bias&&(
        <div>
          <div className="bias-meter">
            <div className="bias-track">
              {biasLabels.map(l=>(
                <div key={l} className="bias-seg" style={{background:biasColors[l],opacity:data.bias.bias===l?1:0.25,transition:'opacity 0.4s'}}/>
              ))}
            </div>
            <div style={{fontWeight:700,marginBottom:'0.3rem',color:biasColors[data.bias.bias]||'var(--ink)'}}>
              {data.bias.bias} · {data.bias.confidence}% confidence
            </div>
            <div className="ai-content">{textValue(data.bias.note)}</div>
          </div>
        </div>
      )}
      {!loading&&tab==='eli5'&&data.eli5&&<div className="ai-content">{textValue(data.eli5.explanation)}</div>}
      {tab==='translate'&&(
        <div>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:'0.8rem',flexWrap:'wrap'}}>
            <select className="translate-select" value={lang} onChange={e=>setLang(e.target.value)}>
              {LANGUAGES.map(l=><option key={l}>{l}</option>)}
            </select>
            <button className="pill" style={{background:'var(--ink)', color:'var(--bg)'}} onClick={fetchTranslate}>Translate</button>
          </div>
          {!loading&&data[`translate_${lang}`]&&<div className="ai-content">{data[`translate_${lang}`]}</div>}
        </div>
      )}
      {!loading&&tab==='tags'&&data.tags&&(
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {(data.tags.tags||[]).map(t=><span key={t} className="pill" style={{fontSize:'0.75rem',padding:'4px 10px'}}>{t}</span>)}
        </div>
      )}
    </div>
  );
}

// ══ STAR RATING ═══════════════════════════════════════════════════════════════
function StarRating({ articleUrl }) {
  const { user } = useAuth();
  const [myRating, setMyRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [avg, setAvg] = useState(0);
  const [total, setTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const id = docId(articleUrl);

  useEffect(()=>{
    if (!isFirebaseEnabled) {
      const ratings = JSON.parse(localStorage.getItem('newsai_demo_ratings')||'{}');
      const summary = JSON.parse(localStorage.getItem('newsai_demo_rating_summary')||'{}');
      const userRating = user ? ratings[`${id}_${user.uid}`] : null;
      if (userRating) setMyRating(userRating.rating);
      if (summary[id]) { setAvg(summary[id].avg||0); setTotal(summary[id].count||0); }
      return undefined;
    }

    const unsub=onSnapshot(doc(db,'ratings_summary',id),snap=>{
      if(snap.exists()){ setAvg(snap.data().avg||0); setTotal(snap.data().count||0); }
    });
    if(user){ getDoc(doc(db,'ratings',`${id}_${user.uid}`)).then(snap=>{ if(snap.exists()) setMyRating(snap.data().rating); }); }
    return()=>unsub();
  },[articleUrl,user,id]);

  async function rate(star) {
    if(!user){toast.error('Sign in to rate articles');return;}
    setSaving(true);
    try {
      const newCount=myRating===0?total+1:total;
      const newAvg=myRating===0?((avg*total)+star)/newCount:((avg*total)-myRating+star)/Math.max(1,total);
      if (!isFirebaseEnabled) {
        const ratings = JSON.parse(localStorage.getItem('newsai_demo_ratings')||'{}');
        const summary = JSON.parse(localStorage.getItem('newsai_demo_rating_summary')||'{}');
        ratings[`${id}_${user.uid}`] = { articleUrl, rating:star, userId:user.uid, userName:user.displayName||'Anonymous', createdAt:new Date().toISOString() };
        summary[id] = { articleUrl, avg:Math.round(newAvg*10)/10, count:newCount };
        localStorage.setItem('newsai_demo_ratings', JSON.stringify(ratings));
        localStorage.setItem('newsai_demo_rating_summary', JSON.stringify(summary));
      } else {
        await setDoc(doc(db,'ratings',`${id}_${user.uid}`),{articleUrl,rating:star,userId:user.uid,userName:user.displayName||'Anonymous',createdAt:serverTimestamp()});
        await setDoc(doc(db,'ratings_summary',id),{articleUrl,avg:Math.round(newAvg*10)/10,count:newCount});
      }
      setAvg(Math.round(newAvg*10)/10);
      setTotal(newCount);
      setMyRating(star); toast.success(`Rated ${star} ⭐`);
    } catch { toast.error('Failed to save rating'); }
    setSaving(false);
  }

  return (
    <div className="rating-box">
      <div className="rating-label">Rate this article</div>
      <div className="stars-row">
        {[1,2,3,4,5].map(star=>(
          <button key={star} className="star-btn"
            onMouseEnter={()=>setHovered(star)} onMouseLeave={()=>setHovered(0)}
            onClick={()=>rate(star)} disabled={saving}>
            <span style={{filter:(hovered||myRating)>=star?'none':'grayscale(1) opacity(0.35)',transform:(hovered||myRating)>=star?'scale(1.2)':'scale(1)',display:'inline-block',transition:'all 0.15s'}}>⭐</span>
          </button>
        ))}
      </div>
      {myRating>0&&<div className="my-rating-text">Your rating: {myRating}/5</div>}
      {total>0&&<div className="avg-rating">⭐ {avg}/5 · {total} rating{total!==1?'s':''}</div>}
    </div>
  );
}

// ══ COMMENTS ═════════════════════════════════════════════════════════════════
function Comments({ article }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCmts, setLoadingCmts] = useState(true);
  const articleUrl = article.url;

  useEffect(()=>{
    if (!isFirebaseEnabled) {
      const allComments = JSON.parse(localStorage.getItem('newsai_demo_comments')||'{}');
      setComments(allComments[docId(articleUrl)]||[]);
      setLoadingCmts(false);
      return undefined;
    }

    try {
      const q=query(collection(db,'comments'),where('articleUrl','==',articleUrl),orderBy('createdAt','desc'));
      const unsub=onSnapshot(q,snap=>{
        setComments(snap.docs.map(d=>({id:d.id,...d.data()})));
        setLoadingCmts(false);
      },()=>setLoadingCmts(false));
      return()=>unsub();
    } catch { setLoadingCmts(false); }
  },[articleUrl]);

  async function postComment(e) {
    e.preventDefault();
    if(!user){toast.error('Sign in to comment');return;}
    if(!text.trim()||text.trim().length<3){toast.error('Write at least 3 characters');return;}
    setLoading(true);
    try {
      if (!isFirebaseEnabled) {
        const allComments = JSON.parse(localStorage.getItem('newsai_demo_comments')||'{}');
        const key = docId(articleUrl);
        const comment = {
          id:`demo-${Date.now()}`,
          articleUrl, articleTitle:article.title, articleSource:article.source, articlePublishedAt:article.publishedAt,
          text:text.trim(),
          userId:user.uid, userName:user.displayName||'Anonymous',
          userPhoto:user.photoURL||null, createdAt:new Date().toISOString(),
        };
        const nextComments = [comment, ...(allComments[key]||[])];
        allComments[key] = nextComments;
        localStorage.setItem('newsai_demo_comments', JSON.stringify(allComments));
        setComments(nextComments);
      } else {
        await addDoc(collection(db,'comments'),{
          articleUrl, articleTitle:article.title, articleSource:article.source, articlePublishedAt:article.publishedAt,
          text:text.trim(),
          userId:user.uid, userName:user.displayName||'Anonymous',
          userPhoto:user.photoURL||null, createdAt:serverTimestamp(),
        });
      }
      setText(''); toast.success('Comment posted! 💬');
    } catch { toast.error('Failed to post comment'); }
    setLoading(false);
  }

  const initials = user ? (user.displayName?user.displayName.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2):user.email[0].toUpperCase()) : '';

  return (
    <div style={{marginTop:'1.2rem'}}>
      <h4 style={{fontSize:'0.9rem',fontWeight:700,color:'var(--ink)',marginBottom:'1rem'}}>💬 Comments ({comments.length})</h4>
      {user ? (
        <form onSubmit={postComment} className="comment-form">
          <div className="comment-input-row">
            {user.photoURL
              ?<img src={user.photoURL} alt="" style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
              :<div className="comment-initials-avatar">{initials}</div>
            }
            <textarea className="comment-textarea" value={text} onChange={e=>setText(e.target.value.slice(0,500))} placeholder="Share your thoughts on this article..." rows={2}/>
          </div>
          <div className="comment-form-footer">
            <span className="comment-char" style={{fontSize:'0.72rem', color:'var(--muted)'}}>{text.length}/500</span>
            <button type="submit" className="pill" style={{background:'var(--ink)', color:'var(--bg)'}} disabled={loading||!text.trim()}>
              {loading?'Posting...':'Post →'}
            </button>
          </div>
        </form>
      ) : (
        <div className="sign-in-prompt">🔐 <strong>Sign in</strong> to join the discussion</div>
      )}
      <div className="comments-list">
        {loadingCmts&&<div className="comments-empty">Loading comments...</div>}
        {!loadingCmts&&comments.length===0&&<div className="comments-empty">No comments yet — be the first! 👋</div>}
        {comments.map(c=>(
          <div key={c.id} className="comment-item">
            <div>
              {c.userPhoto
                ?<img src={c.userPhoto} alt="" style={{width:36,height:36,borderRadius:'50%',objectFit:'cover'}}/>
                :<div className="comment-initials-avatar" style={{fontSize:'0.8rem'}}>{(c.userName||'A')[0].toUpperCase()}</div>
              }
            </div>
            <div className="comment-body" style={{flex:1}}>
              <div className="comment-header">
                <span className="comment-name">{c.userName||'Anonymous'}</span>
                <span className="comment-time">{commentTimeAgo(c.createdAt)}</span>
              </div>
              <p className="comment-text">{c.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══ ARTICLE MODAL ══════════════════════════════════════════════════════════════
function ArticleModal({ article, onClose }) {
  const [saved, setSaved] = useState(()=>{
    const s=JSON.parse(localStorage.getItem('savedArticles')||'[]');
    return s.some(a=>a.url===article.url);
  });
  useEffect(()=>{ document.body.style.overflow='hidden'; return()=>{document.body.style.overflow='';} },[]);

  function toggleSave() {
    const saved_=getSavedArticles();
    const exists=saved_.some(a=>a.url===article.url);
    if(exists){ setSavedArticles(saved_.filter(a=>a.url!==article.url)); toast('Removed from saved'); setSaved(false); }
    else { setSavedArticles([article,...saved_]); toast.success('Article saved!'); setSaved(true); }
  }

  const text=article.description||'';
  const ytId = getYoutubeId(article.url);

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()} style={{padding:0}}>
      <div className="modal-card">
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        {ytId ? (
          <iframe 
            src={`https://www.youtube.com/embed/${ytId}`} 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
            style={{ width: 'calc(100% + 5rem)', height: '400px', borderRadius: '28px 28px 0 0', margin: '-2.5rem -2.5rem 2rem -2.5rem', display: 'block' }}
          ></iframe>
        ) : article.image ? (
          <img className="modal-hero-img" src={article.image} alt={article.title} onError={e=>e.target.style.display='none'}/>
        ) : null}
        
        <div className="modal-body">
          <div className="card-header-meta" style={{marginBottom:'1rem'}}>
            <span className="card-source">{article.source}</span>
            <span>·</span>
            <span>{timeAgo(article.publishedAt)}</span>
            <span>·</span>
            <span>⏱ {readTime(text)}</span>
            <span className={`difficulty-badge ${diffLevel(text)}`}>{diffLevel(text)}</span>
          </div>
          <h1 className="modal-title">{article.title}</h1>
          {text&&<p className="modal-desc">{text}</p>}
          <AIPanel article={article}/>
          <div style={{display:'flex', gap:10, flexWrap:'wrap', marginTop:'1.5rem'}}>
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="btn-primary">Read Full Article ↗</a>
            <button className="pill" onClick={toggleSave} style={{padding: '0 24px', borderRadius: '99px'}}>{saved?'🔖 Saved':'🔖 Save'}</button>
            <button className="pill" onClick={()=>shareArticle(article)} style={{padding: '0 24px', borderRadius: '99px'}}>📤 Share</button>
          </div>
          <div className="cr-section">
            <h3 className="cr-title">Community</h3>
            <StarRating articleUrl={article.url}/>
            <Comments article={article}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══ MODALS & FORMS ════════════════════════════════════════════════════════════
function WriteArticleModal({ onClose, onPublish }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ title:'', description:'', image:'', source:'NewsAI', category:'News' });
  const [loading, setLoading] = useState(false);

  const onChange = e => setForm(f=>({...f,[e.target.name]:e.target.value}));

  async function handleSubmit(e) {
    e.preventDefault();
    if(!form.title || !form.description) return toast.error('Title and description required');
    setLoading(true);
    const newArticle = { ...form, id: `custom-${Date.now()}`, publishedAt: new Date().toISOString(), url: `https://newsai.local/article/${Date.now()}`, isCustom: true, author: user.displayName || user.email };
    try {
      if (!isFirebaseEnabled) {
        const customArticles = JSON.parse(localStorage.getItem('newsai_custom_articles')||'[]');
        localStorage.setItem('newsai_custom_articles', JSON.stringify([newArticle, ...customArticles]));
      } else { await addDoc(collection(db,'custom_articles'), newArticle); }
      toast.success('Article published successfully!'); onPublish(newArticle); onClose();
    } catch { toast.error('Failed to publish article'); }
    setLoading(false);
  }

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-card write-article-form" style={{maxWidth: 600}}>
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        <div style={{textAlign:'center', marginBottom:'2rem'}}>
          <div style={{fontSize:'3.5rem', marginBottom:'0.5rem'}}>✍️</div>
          <h2 style={{fontFamily:'var(--font-display)', fontSize:'2rem', fontWeight:900, color:'var(--ink)'}}>Write Article</h2>
          <p style={{fontSize:'1rem', color:'var(--muted)'}}>Share your news or opinion with the community.</p>
        </div>
        <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column'}}>
          <div className="form-field">
            <label className="form-label">Headline</label>
            <input className="form-input" name="title" value={form.title} onChange={onChange} placeholder="Enter an engaging headline..." />
          </div>
          <div className="form-field">
            <label className="form-label">Cover Image URL</label>
            <input className="form-input" name="image" value={form.image} onChange={onChange} placeholder="https://..." />
          </div>
          <div className="form-field">
            <label className="form-label">Category</label>
            <select className="form-input" name="category" value={form.category} onChange={onChange}>
              {CATS.filter(c=>c!=='All').map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Content</label>
            <textarea className="form-input" name="description" value={form.description} onChange={onChange} placeholder="Write your article content here..." rows={6} />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{marginTop:'0.5rem', padding:'16px'}}>
            {loading ? 'Publishing...' : 'Publish Article'}
          </button>
        </form>
      </div>
    </div>
  );
}

function SuggestArticle({ onClose }) {
  const { user } = useAuth();
  const [form, setForm] = useState({title:'',url:'',description:'',category:'News',reason:''});
  const [loading, setLoading] = useState(false);
  const onChange = e => setForm(f=>({...f,[e.target.name]:e.target.value}));

  async function handleSubmit(e) {
    e.preventDefault();
    if(!form.title||!form.url){toast.error('Title and URL are required');return;}
    if(!form.url.startsWith('http')){toast.error('URL must start with http');return;}
    setLoading(true);
    try {
      if (!isFirebaseEnabled) {
        const suggestions = JSON.parse(localStorage.getItem('newsai_demo_suggestions')||'[]');
        suggestions.unshift({
          id:`demo-${Date.now()}`, ...form,
          submittedBy:{uid:user.uid,name:user.displayName||'Anonymous',email:user.email,photo:user.photoURL||null},
          status:'pending', votes:0, createdAt:new Date().toISOString(),
        });
        localStorage.setItem('newsai_demo_suggestions', JSON.stringify(suggestions));
      } else {
        await addDoc(collection(db,'suggestions'),{
          ...form, submittedBy:{uid:user.uid,name:user.displayName||'Anonymous',email:user.email,photo:user.photoURL||null},
          status:'pending', votes:0, createdAt:serverTimestamp(),
        });
      }
      toast.success('Article suggested! Thank you 🎉'); onClose();
    } catch { toast.error('Failed to submit. Check your internet.'); }
    setLoading(false);
  }

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-card" style={{maxWidth: 550}}>
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        <div style={{textAlign:'center', marginBottom:'2rem'}}>
          <div style={{fontSize:'3.5rem', marginBottom:'0.5rem'}}>💡</div>
          <h2 style={{fontFamily:'var(--font-display)', fontSize:'2rem', fontWeight:900, color:'var(--ink)'}}>Suggest an Article</h2>
          <p style={{fontSize:'1rem', color:'var(--muted)'}}>Know a great story? Share it with the community!</p>
        </div>
        <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column'}}>
          <div className="form-field">
            <label className="form-label">Article Title *</label>
            <input name="title" value={form.title} onChange={onChange} placeholder="Enter the article headline..." className="form-input"/>
          </div>
          <div className="form-field">
            <label className="form-label">Article URL *</label>
            <input name="url" value={form.url} onChange={onChange} placeholder="https://..." className="form-input"/>
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{marginTop:'0.5rem', padding:'16px'}}>
            {loading?'Submitting...':'Submit Suggestion'}
          </button>
        </form>
      </div>
    </div>
  );
}

function MyCommentsModal({ onClose }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  useEffect(()=>{
    const all = JSON.parse(localStorage.getItem('newsai_demo_comments')||'{}');
    let myCmts = [];
    Object.keys(all).forEach(k => { myCmts = [...myCmts, ...all[k].filter(c=>c.userId===user.uid)]; });
    setComments(myCmts.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));
  },[user.uid]);

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-card" style={{maxWidth:600}}>
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        <div style={{textAlign:'center', marginBottom:'2rem'}}>
          <div style={{fontSize:'3.5rem', marginBottom:'0.5rem'}}>💬</div>
          <h2 style={{fontFamily:'var(--font-display)', fontSize:'2rem', fontWeight:900, color:'var(--ink)'}}>My Comments</h2>
          <p style={{fontSize:'1rem', color:'var(--muted)'}}>Manage your past discussions.</p>
        </div>
        <div style={{maxHeight:'50vh', overflowY:'auto', paddingRight:'1rem'}}>
          {comments.length===0 && <div style={{textAlign:'center', color:'var(--muted)', padding:'3rem', background:'var(--bg)', borderRadius:'16px'}}>No comments found.</div>}
          {comments.map((c,i)=>(
            <div key={i} className="modal-list-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
              <div style={{fontSize:'0.9rem', fontWeight:700, color:'var(--accent)', marginBottom:8}}>{c.articleTitle}</div>
              <div style={{fontSize:'1rem', color:'var(--ink)', marginBottom:8, fontStyle:'italic'}}>"{c.text}"</div>
              <div style={{fontSize:'0.75rem', color:'var(--muted)'}}>{commentTimeAgo(c.createdAt)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuggestedArticlesModal({ onClose, onPublish }) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [isAdminView, setIsAdminView] = useState(false);

  useEffect(()=>{
    fetchSuggestions();
  },[]);

  function fetchSuggestions() {
    if (!isFirebaseEnabled) {
      const all = JSON.parse(localStorage.getItem('newsai_demo_suggestions')||'[]');
      setSuggestions(all);
    } else {
      const q = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'));
      onSnapshot(q, snap => {
        setSuggestions(snap.docs.map(d => ({id: d.id, ...d.data()})));
      });
    }
  }

  async function handleAction(suggestion, action) {
    try {
      if (!isFirebaseEnabled) {
        const all = JSON.parse(localStorage.getItem('newsai_demo_suggestions')||'[]');
        const updated = all.map(s => s.id === suggestion.id ? { ...s, status: action } : s);
        localStorage.setItem('newsai_demo_suggestions', JSON.stringify(updated));
        
        if (action === 'approved') {
          const customArticles = JSON.parse(localStorage.getItem('newsai_custom_articles')||'[]');
          const newArticle = { title: suggestion.title, url: suggestion.url, category: suggestion.category, description: suggestion.description||'', source: 'NewsAI Community', publishedAt: new Date().toISOString(), id: `custom-${Date.now()}`, isCustom: true };
          localStorage.setItem('newsai_custom_articles', JSON.stringify([newArticle, ...customArticles]));
          onPublish(newArticle);
        }
        setSuggestions(updated);
        toast.success(`Article ${action}!`);
      } else {
        await setDoc(doc(db, 'suggestions', suggestion.id), { status: action }, { merge: true });
        if (action === 'approved') {
          const newArticle = { title: suggestion.title, url: suggestion.url, category: suggestion.category, description: suggestion.description||'', source: 'NewsAI Community', publishedAt: new Date().toISOString(), id: `custom-${Date.now()}`, isCustom: true };
          await addDoc(collection(db,'custom_articles'), newArticle);
          onPublish(newArticle);
        }
        toast.success(`Article ${action}!`);
      }
    } catch (e) {
      toast.error('Failed to update status');
    }
  }

  const displayed = isAdminView ? suggestions : suggestions.filter(s=>s.submittedBy.uid===user.uid);

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-card" style={{maxWidth:700}}>
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        <div style={{textAlign:'center', marginBottom:'1.5rem'}}>
          <div style={{fontSize:'3.5rem', marginBottom:'0.5rem'}}>📋</div>
          <h2 style={{fontFamily:'var(--font-display)', fontSize:'2rem', fontWeight:900, color:'var(--ink)'}}>Suggested Articles</h2>
          <p style={{fontSize:'1rem', color:'var(--muted)'}}>Manage article suggestions.</p>
        </div>
        
        {user?.email === 'admin@gmail.com' && (
          <div style={{display:'flex', justifyContent:'center', marginBottom:'1rem'}}>
            <div style={{background:'var(--bg)', borderRadius:'99px', padding:'4px', display:'inline-flex'}}>
              <button className={`pill ${!isAdminView?'active':''}`} style={{border:'none', boxShadow:'none'}} onClick={()=>setIsAdminView(false)}>My Suggestions</button>
              <button className={`pill ${isAdminView?'active':''}`} style={{border:'none', boxShadow:'none'}} onClick={()=>setIsAdminView(true)}>Admin View</button>
            </div>
          </div>
        )}

        <div style={{maxHeight:'45vh', overflowY:'auto', paddingRight:'1rem'}}>
          {displayed.length===0 && <div style={{textAlign:'center', color:'var(--muted)', padding:'3rem', background:'var(--bg)', borderRadius:'16px'}}>No suggestions found.</div>}
          {displayed.map((s,i)=>(
            <div key={i} className="modal-list-item" style={{flexDirection:'column', alignItems:'stretch'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.5rem'}}>
                <div style={{paddingRight:'1rem'}}>
                  <div style={{fontSize:'1rem', fontWeight:700, color:'var(--ink)', marginBottom:4}}>{s.title}</div>
                  <div style={{fontSize:'0.8rem', color:'var(--muted)'}}>By {s.submittedBy?.name || 'User'} on {new Date(s.createdAt).toLocaleDateString()}</div>
                </div>
                <span className="pill" style={{background:s.status==='pending'?'var(--neutral)':s.status==='approved'?'var(--positive)':'var(--negative)', color:'white', fontSize:'0.75rem'}}>
                  {s.status.toUpperCase()}
                </span>
              </div>
              <a href={s.url} target="_blank" rel="noreferrer" style={{fontSize:'0.8rem', color:'var(--accent)', marginBottom:'0.5rem', wordBreak:'break-all'}}>{s.url}</a>
              {isAdminView && s.status === 'pending' && (
                <div style={{display:'flex', gap:'8px', marginTop:'0.5rem'}}>
                  <button className="pill" style={{background:'var(--positive)', color:'white', flex:1, justifyContent:'center'}} onClick={()=>handleAction(s, 'approved')}>✓ Approve</button>
                  <button className="pill" style={{background:'var(--negative)', color:'white', flex:1, justifyContent:'center'}} onClick={()=>handleAction(s, 'rejected')}>✕ Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SavedArticlesModal({ onClose, onOpenArticle }) {
  const saved = getSavedArticles();
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-card" style={{maxWidth:650}}>
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        <div style={{textAlign:'center', marginBottom:'2rem'}}>
          <div style={{fontSize:'3.5rem', marginBottom:'0.5rem'}}>🔖</div>
          <h2 style={{fontFamily:'var(--font-display)', fontSize:'2rem', fontWeight:900, color:'var(--ink)'}}>My Saved Articles</h2>
          <p style={{fontSize:'1rem', color:'var(--muted)'}}>Read them whenever you want.</p>
        </div>
        <div className="small-article-list" style={{maxHeight:'55vh', overflowY:'auto', paddingRight:'1rem'}}>
          {saved.length===0 && <div style={{textAlign:'center', color:'var(--muted)', padding:'3rem', background:'var(--bg)', borderRadius:'16px'}}>No saved articles yet.</div>}
          {saved.map(a=>(
             <div key={a.url} className="modal-list-item" onClick={()=>{onClose(); onOpenArticle(a);}} style={{cursor:'pointer', padding:'12px'}}>
                <img className="small-thumb" src={a.image||`https://picsum.photos/seed/${docId(a.title)}/100/100`} alt="" style={{width:80, height:80, borderRadius:'12px'}}/>
                <div className="small-article-content" style={{marginLeft:'1rem'}}>
                  <div className="small-title" style={{fontSize:'1rem'}}>{a.title}</div>
                  <div className="small-meta" style={{marginTop:'0.5rem'}}>{a.source} · {timeAgo(a.publishedAt)}</div>
                </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══ OTD & TICKER ══════════════════════════════════════════════════════════════
function OnThisDay() {
  const [events, setEvents] = useState([]);
  useEffect(()=>{ axios.get('/api/onthisday').then(r=>setEvents(r.data.events||[])).catch(()=>{}); },[]);
  if(!events.length) return null;
  return (
    <div className="on-this-day">
      <div className="otd-label">On This Day</div>
      <div className="otd-events">
        {events.map((e,i)=>(
          <div key={i} className="otd-event">
            <div className="otd-year">{e.year}</div>
            <div className="otd-text">{e.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakingTicker({ articles }) {
  if(!articles.length) return null;
  const text=articles.slice(0,8).map(a=>a.title).join('   ·   ');
  return (
    <div className="ticker-wrap">
      <div className="ticker-label">⚡ Breaking</div>
      <div className="ticker-content" style={{paddingLeft:'120px'}}>{text} &nbsp;·&nbsp; {text}</div>
    </div>
  );
}

// ══ VOICE SEARCH FAB ══════════════════════════════════════════════════════════
function VoiceSearch({ onResult }) {
  const [listening, setListening] = useState(false);
  
  function toggleListen() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice search is not supported in this browser.');
      return;
    }
    if (listening) return;
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    
    recognition.onstart = () => { setListening(true); toast('Listening...'); };
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
      toast.success(`Searched: "${transcript}"`);
    };
    recognition.onerror = () => { setListening(false); toast.error('Voice search failed.'); };
    recognition.onend = () => setListening(false);
    
    recognition.start();
  }

  return (
    <button className={`chatbot-fab ${listening ? 'listening' : ''}`} onClick={toggleListen} title="Voice Search" style={{background: listening?'var(--negative)':'var(--accent)', color:'white'}}>
      {listening ? <div className="spinner" style={{borderColor:'white',borderTopColor:'transparent'}}/> : '🎤'}
    </button>
  );
}

// ══ NAVBAR ════════════════════════════════════════════════════════════════════
function Navbar({ category, setCategory, onOpenWrite, theme, setTheme, onSuggest, onSaved, onComments, onSuggestions }) {
  const { user } = useAuth();

  return (
    <nav className="main-nav">
      <div className="nav-left">
        <div className="logo-pill">
          <img src="/logo.png" alt="NewsAI" style={{height: 24, width: 'auto'}} />
          NewsAI
        </div>
        <div className="nav-links">
          {CATS.map(cat => (
            <button 
              key={cat} 
              className={`pill ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      
      <div className="nav-right">
        <div className="navbar-meta"><LiveClock/><WeatherWidget/></div>
        {user ? (
          <>
            <button className="pill" onClick={onOpenWrite} style={{background:'var(--ink)', color:'var(--bg)'}}>
              + Write
            </button>
            <UserMenu onOpenSuggest={onSuggest} onOpenSaved={onSaved} onOpenComments={onComments} onOpenSuggestions={onSuggestions} theme={theme} setTheme={setTheme}/>
          </>
        ) : (
          <span style={{fontSize:'0.75rem',color:'var(--muted)',fontWeight:600,whiteSpace:'nowrap'}}>Sign in ↑</span>
        )}
      </div>
    </nav>
  );
}

// ══ ARTICLE CARD ══════════════════════════════════════════════════════════════
function ArticleCard({ article, onClick }) {
  const ytId = getYoutubeId(article.url);
  const fallbackImg = `https://picsum.photos/seed/${docId(article.url || article.title).slice(0,5)}/600/400`;

  return (
    <div className="article-card" onClick={()=>onClick(article)}>
      <div className="card-header-meta">
        <span className="card-source">{article.source}</span>
        <span>·</span>
        <span>{timeAgo(article.publishedAt)}</span>
      </div>
      <h3 className="card-title">{article.title}</h3>
      <div className="card-image-wrap">
        {ytId ? (
          <div style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden'}}>
            <iframe 
              src={`https://www.youtube.com/embed/${ytId}`} 
              style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}} 
              frameBorder="0" 
              allowFullScreen 
              title={article.title}
            ></iframe>
          </div>
        ) : (
          <img src={article.image || fallbackImg} alt={article.title} onError={e=>e.target.src=fallbackImg} loading="lazy" />
        )}
      </div>
      <div className="card-footer">
        <div className="card-tags">
          <button className="icon-btn" style={{width:32,height:32,border:'none',background:'transparent',color:'var(--ink2)',fontSize:'1.2rem'}}>...</button>
        </div>
        <button className="pill">
          Read <span style={{fontSize:'1.1rem'}}>→</span>
        </button>
      </div>
    </div>
  );
}

// ══ MAIN APP ═══════════════════════════════════════════════════════════════════
export default function App() {
  const { user } = useAuth();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [writeOpen, setWriteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  
  const containerRef = useRef(null);

  useEffect(()=>{ document.documentElement.setAttribute('data-theme',theme); },[theme]);

  async function fetchNews(cat = category, q = searchQuery) {
    setLoading(true);
    try {
      const params = { category: cat === 'All' ? 'general' : cat.toLowerCase(), page: 1 };
      if(q) params.q = q;
      
      const res = await axios.get('/api/news', { params });
      let arts = uniqueArticles((res.data.articles||[]).map(a=>({...a,category:a.category||cat})));
      
      const customArticles = JSON.parse(localStorage.getItem('newsai_custom_articles')||'[]');
      const filteredCustom = customArticles.filter(a => 
        (cat === 'All' || a.category === cat) && 
        (!q || a.title.toLowerCase().includes(q.toLowerCase()))
      );

      arts = [...filteredCustom, ...arts];
      setArticles(arts);
    } catch { 
      toast.error('Failed to load news'); 
    }
    setLoading(false);
  }

  useEffect(() => { 
    setSearchQuery(''); 
    fetchNews(category, ''); 
  }, [category]);

  useGSAP(() => {
    if (!loading && articles.length > 0) {
      gsap.from('.anim-in', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.05,
        ease: 'power2.out',
        clearProps: 'all'
      });
    }
  }, [loading, articles]);

  const handleSearchInline = (e) => {
    if (e.key === 'Enter') {
      fetchNews(category, searchQuery);
    }
  };

  const handleVoiceSearch = (transcript) => {
    setSearchQuery(transcript);
    fetchNews(category, transcript);
  };

  if(!user) return <AuthPage/>;

  const heroArticle = articles.length > 0 ? articles[0] : null;
  const recommendedArticles = articles.length > 5 ? articles.slice(1, 6) : articles.slice(1);
  const gridArticles = articles.length > 6 ? articles.slice(6) : articles.slice(1);

  const heroYtId = heroArticle ? getYoutubeId(heroArticle.url) : null;

  return (
    <div ref={containerRef}>
      <div id="reading-progress"/>
      <Navbar 
        category={category} setCategory={setCategory} 
        onOpenWrite={()=>setWriteOpen(true)} 
        theme={theme} setTheme={setTheme}
        onSuggest={()=>setSuggestOpen(true)}
        onSaved={()=>setSavedOpen(true)}
        onComments={()=>setCommentsOpen(true)}
        onSuggestions={()=>setSuggestionsOpen(true)}
      />
      
      <BreakingTicker articles={articles}/>
      <OnThisDay/>

      <div className="page-container">
        {/* LEFT MAIN CONTENT */}
        <div className="main-content">
          {loading ? (
             <div className="skeleton-card" style={{height:400}}></div>
          ) : heroArticle ? (
            <div className="hero-card anim-in" onClick={()=>setSelected(heroArticle)}>
              <div className="hero-card-bg">
                {heroYtId ? (
                  <div style={{width:'100%', height:'100%', background:'#000'}}/>
                ) : (
                  <img src={heroArticle.image || `https://picsum.photos/seed/${docId(heroArticle.title)}/1200/600`} alt="" />
                )}
              </div>
              <div style={{position:'relative', zIndex:2}}>
                <div className="hero-badge">BEST OF THE WEEK</div>
                <div className="card-header-meta" style={{color:'var(--accent)'}}>
                  <span className="card-source">{heroArticle.source}</span>
                  <span style={{color:'var(--ink)'}}>·</span>
                  <span style={{color:'var(--ink)'}}>{timeAgo(heroArticle.publishedAt)}</span>
                </div>
                <h1 className="hero-title">{heroArticle.title}</h1>
                <div className="hero-tags">
                  <button className="icon-btn" style={{width:32,height:32,border:'none',background:'var(--surface-solid)',color:'var(--ink2)',fontSize:'1.2rem', boxShadow:'var(--shadow-sm)'}} onClick={(e)=>{e.stopPropagation();}}>...</button>
                </div>
              </div>
              <div className="hero-bottom-meta" style={{position:'relative', zIndex:2}}>
                <button className="hero-action">
                  Read article <span>→</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{padding:'2rem', textAlign:'center', color:'var(--muted)'}}>No articles found.</div>
          )}

          {!loading && (
            <Masonry breakpointCols={BREAKPOINTS} className="my-masonry-grid" columnClassName="my-masonry-grid_column">
              {gridArticles.map((a,i)=><div key={`${a.url}-${i}`} className="anim-in"><ArticleCard article={a} onClick={setSelected} /></div>)}
            </Masonry>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="sidebar">
          <div className="search-pill-container anim-in">
            <input 
              placeholder="Search news..." 
              value={searchQuery}
              onChange={(e)=>setSearchQuery(e.target.value)}
              onKeyDown={handleSearchInline}
            />
            <button className="search-icon-btn" onClick={()=>fetchNews(category, searchQuery)}>🔍</button>
          </div>

          <div className="sidebar-section anim-in">
            <div className="widget-header">
              <span className="widget-title">Sentiment Today</span>
            </div>
            <div className="sentiment-dashboard">
              {[['Positive',42,'positive','😊'],['Negative',28,'negative','😢'],['Neutral',30,'neutral','😐']].map(([l,v,c,e])=>(
                <div key={l} className="sentiment-bar-wrap">
                  <div className="sentiment-bar-label"><span>{e} {l}</span><span>{v}%</span></div>
                  <div className="sentiment-bar"><div className={`sentiment-bar-fill ${c}`} style={{width:`${v}%`}}/></div>
                </div>
              ))}
            </div>
          </div>

          <div className="recommended-widget anim-in">
            <div className="widget-header">
              <span className="widget-title">Recommended</span>
            </div>

            {recommendedArticles.length > 0 && (
              <div className="recommended-featured" onClick={()=>setSelected(recommendedArticles[0])}>
                {getYoutubeId(recommendedArticles[0].url) ? (
                   <div style={{width:'100%', height:'100%', background:'#000', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'2rem'}}>▶️</div>
                ) : (
                   <img src={recommendedArticles[0].image || `https://picsum.photos/seed/${docId(recommendedArticles[0].title)}/600/400`} alt="" />
                )}
                <div className="featured-overlay">
                  <div className="featured-meta">{recommendedArticles[0].source} · {timeAgo(recommendedArticles[0].publishedAt)}</div>
                  <div className="featured-title">{recommendedArticles[0].title}</div>
                </div>
              </div>
            )}

            <div className="small-article-list">
              {recommendedArticles.slice(1).map((a,i)=>(
                <div key={i} className="small-article-item" onClick={()=>setSelected(a)}>
                  <div className="small-article-content">
                    <div className="small-meta">
                      <span className="source">{a.source}</span>
                      <span>·</span>
                      <span>{timeAgo(a.publishedAt)}</span>
                    </div>
                    <div className="small-title">{a.title}</div>
                  </div>
                  {getYoutubeId(a.url) ? (
                    <div className="small-thumb" style={{background:'#000', display:'flex', alignItems:'center', justifyContent:'center', color:'white'}}>▶️</div>
                  ) : (
                    <img className="small-thumb" src={a.image || `https://picsum.photos/seed/${docId(a.title)}/200/200`} alt="" />
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* MODALS */}
      {selected&&<ArticleModal article={selected} onClose={()=>setSelected(null)}/>}
      {writeOpen && <WriteArticleModal onClose={()=>setWriteOpen(false)} onPublish={(article)=>fetchNews()} />}
      {suggestOpen&&<SuggestArticle onClose={()=>setSuggestOpen(false)}/>}
      {savedOpen&&<SavedArticlesModal onClose={()=>setSavedOpen(false)} onOpenArticle={setSelected}/>}
      {commentsOpen&&<MyCommentsModal onClose={()=>setCommentsOpen(false)}/>}
      {suggestionsOpen&&<SuggestedArticlesModal onClose={()=>setSuggestionsOpen(false)} onPublish={(article)=>fetchNews()}/>}
      
      {/* VOICE SEARCH */}
      <VoiceSearch onResult={handleVoiceSearch}/>
      
      <footer className="main-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span style={{color:'var(--accent)', marginRight:8}}><img src="/logo.png" alt="NewsAI" style={{height: 32, width: 'auto', display:'inline-block'}} /></span> NewsAI
            <p className="footer-desc">Your intelligent daily news aggregator, providing real-time AI analysis, sentiment scoring, and breaking coverage.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Categories</h4>
              <button onClick={()=>setCategory('Business')}>Business</button>
              <button onClick={()=>setCategory('Technology')}>Technology</button>
              <button onClick={()=>setCategory('Entertainment')}>Entertainment</button>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <button>About Us</button>
              <button>Careers</button>
              <button>Privacy Policy</button>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 NewsAI. All rights reserved.</span>
          <div className="footer-socials">
            <button className="icon-btn">𝕏</button>
            <button className="icon-btn">in</button>
            <button className="icon-btn">f</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
