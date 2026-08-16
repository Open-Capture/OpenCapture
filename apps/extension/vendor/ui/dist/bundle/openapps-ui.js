import{a as c,b as L,c as ne,d as ie}from"./chunk-LCQWCHVU.js";var y=class extends Error{code;status;balance;detail;constructor(t,e,r=0,n,i){super(e),this.name="OpenAppsError",this.code=t,this.status=r,this.balance=n,this.detail=i}get isAuthError(){return this.code==="unauthorized"}},ut={400:"bad_request",401:"unauthorized",402:"insufficient_balance",404:"not_found",409:"conflict",429:"rate_limited"};function Ie(s,t){let e=t&&typeof t=="object"?t.error:void 0,r=e&&typeof e=="object"?e:void 0,n=r?.code??ut[s]??"internal",i=r?.message??`request failed with status ${s}`,a;if(n==="insufficient_balance"){let h=/-?\d+/.exec(i);h&&(a=Number(h[0]))}return new y(n,i,s,a,r)}function fe(s=null){let t=s;return{get:()=>t,set:e=>{t=e}}}function pt(s="openapps.session"){let t=null;try{t=typeof localStorage<"u"?localStorage:null,t?.setItem(s,t.getItem(s)??""),t?.getItem(s)===""&&t.removeItem(s)}catch{t=null}if(!t)return fe();let e=t;return{get(){let r=e.getItem(s);if(!r)return null;try{let n=JSON.parse(r);return n.accessToken&&n.refreshToken?n:null}catch{return null}},set(r){r?e.setItem(s,JSON.stringify(r)):e.removeItem(s)}}}function ze(){try{return typeof localStorage<"u"?pt():fe()}catch{return fe()}}var ft=new Set(["confirmed","failed","expired"]),B=class{baseUrl;#r;#s;#o;#l;#n=null;#i=null;constructor(t){this.baseUrl=t.baseUrl.replace(/\/+$/,""),this.#r=t.appKey,this.#s=t.store??ze();let e=t.fetch??globalThis.fetch;if(!e)throw new y("network","no fetch implementation available; pass one via options.fetch");this.#o=(r,n)=>e(r,n),this.#l=t.onAuthChange}get session(){return this.#s.get()}get isLoggedIn(){return this.#s.get()!==null}#t(t){this.#s.set(t),this.#l?.(t)}adoptSession(t,e){this.#t({accessToken:t,refreshToken:e})}clearSession(){this.#t(null)}async#e(t,e={}){let r=e.auth??"none";if(r!=="none"&&!this.#s.get())throw new y("unauthorized","not logged in");if(r==="app+bearer"&&!this.#r)throw new y("unauthorized","this call needs an app key; construct OpenApps with { appKey }");return this.#a(t,e,r,!0)}async#a(t,e,r,n){let i=`${this.baseUrl}${t}`;if(e.query){let u=new URLSearchParams;for(let[f,S]of Object.entries(e.query))S!==void 0&&u.set(f,String(S));let g=u.toString();g&&(i+=`?${g}`)}let a={accept:"application/json"};e.body!==void 0&&(a["content-type"]="application/json"),r!=="none"&&(a.authorization=`Bearer ${this.#s.get()?.accessToken??""}`),r==="app+bearer"&&this.#r&&(a["x-openapps-app-key"]=this.#r);let h;try{h=await this.#o(i,{method:e.method??"GET",headers:a,body:e.body===void 0?void 0:JSON.stringify(e.body),signal:e.signal})}catch(u){throw u instanceof Error&&u.name==="AbortError"?u:new y("network",u instanceof Error?u.message:"network request failed")}if(h.status===401&&r!=="none"&&n&&await this.#d())return this.#a(t,e,r,!1);let d=await this.#c(h);if(!h.ok){let u=Ie(h.status,d);throw u.code==="unauthorized"&&r!=="none"&&this.#t(null),u}return d}async#c(t){if(t.status===204)return null;let e=await t.text();if(!e)return null;try{return JSON.parse(e)}catch{throw new y(t.ok?"internal":"network",`expected JSON, got: ${e.slice(0,200)}`,t.status)}}#d(){if(this.#n)return this.#n;let t=this.#s.get();return t?(this.#n=(async()=>{try{let e=await this.#a("/v1/auth/refresh",{method:"POST",body:{refresh_token:t.refreshToken}},"none",!1),r={accessToken:e.access_token,refreshToken:e.refresh_token};return this.#t(r),r}catch{return this.#t(null),null}finally{this.#n=null}})(),this.#n):Promise.resolve(null)}auth={methods:async t=>(await this.#e("/v1/auth/methods",{signal:t})).methods,challenge:(t,e,r)=>this.#e("/v1/auth/challenge",{method:"POST",body:{namespace:t,address:e},signal:r}),verify:async(t,e,r={})=>{let n=await this.#e("/v1/auth/verify",{method:"POST",body:{challenge_id:t,proof:e,referral_code:r.referralCode},signal:r.signal});return this.#t({accessToken:n.access_token,refreshToken:n.refresh_token}),n},googleStartUrl:(t,e)=>{let r=new URLSearchParams;t&&r.set("return_to",t),e&&r.set("ref",e);let n=r.toString();return`${this.baseUrl}/v1/auth/oidc/google/start${n?`?${n}`:""}`},completeRedirect:(t={})=>{let e=gt(t,"code");return e?this.#i?this.#i:(this.#i=(async()=>{try{let r=await this.#e("/v1/auth/oidc/exchange",{method:"POST",body:{code:e},signal:t.signal});return this.#t({accessToken:r.access_token,refreshToken:r.refresh_token}),t.hash===void 0&&t.url===void 0&&typeof history<"u"&&typeof location<"u"&&history.replaceState({},"",location.pathname+location.search),r}finally{this.#i=null}})(),this.#i):Promise.resolve(null)},me:t=>this.#e("/v1/me",{auth:"bearer",signal:t}),logout:async t=>{try{await this.#e("/v1/auth/logout",{method:"POST",auth:"bearer",signal:t})}finally{this.#t(null)}},linkChallenge:(t,e,r)=>this.#e("/v1/auth/link/challenge",{method:"POST",auth:"bearer",body:{namespace:t,address:e},signal:r}),linkVerify:(t,e,r={})=>this.#e("/v1/auth/link/verify",{method:"POST",auth:"bearer",body:{challenge_id:t,proof:e,merge:r.merge??!1},signal:r.signal}),googleLinkStart:async(t,e={})=>(await this.#e("/v1/auth/link/oidc/google/start",{method:"POST",auth:"bearer",body:{return_to:t,merge:e.merge??!1},signal:e.signal})).auth_url,completeLinkRedirect:(t={})=>{let e=qe(t),r=e.get("linked"),n=e.get("link_conflict"),i=e.get("link_blocked"),a=e.get("link_error");if(!r&&!n&&!i&&!a)return null;if(t.hash===void 0&&t.url===void 0&&typeof history<"u"&&history.replaceState({},"",location.pathname+location.search),a)return{status:"error",message:a};if(i){let h=(e.get("clashes")??"").split(",").filter(Boolean),d=h.map(u=>({google:"Google",eip155:"wallet",nostr:"Nostr"})[u]??u).join(" and ");return{status:"blocked",namespaces:h,message:`That Google account belongs to another account which also has a ${d} sign-in, and so does this one. Disconnect it from the other account first.`}}return n?{status:"conflict",namespace:n,balance:Number(e.get("balance")??0)}:{status:"linked",namespace:r,merged:e.get("merged")==="1",credits:Number(e.get("credits")??0)}},unlink:(t,e)=>this.#e(`/v1/auth/link/${encodeURIComponent(t)}`,{method:"DELETE",auth:"bearer",signal:e})};credits={balance:async t=>(await this.#e("/v1/credits/balance",{auth:"bearer",signal:t})).balance,deduct:(t,e,r,n)=>this.#e("/v1/credits/deduct",{method:"POST",auth:"app+bearer",body:{amount:t,reason:e,idempotency_key:r},signal:n}),history:(t={})=>this.#e("/v1/credits/history",{auth:"bearer",query:{cursor:t.cursor,limit:t.limit},signal:t.signal})};payments={packages:t=>this.#e("/v1/payments/packages",{signal:t}),stripeCheckout:(t,e={})=>this.#e("/v1/payments/stripe/checkout",{method:"POST",auth:"bearer",body:{package_id:t,return_to:e.returnTo===null?void 0:e.returnTo??mt()},signal:e.signal}),ethDepositAddress:(t,e)=>this.#e("/v1/payments/eth/deposit-address",{method:"POST",auth:"bearer",body:{package_id:t},signal:e}),lightningInvoice:(t,e)=>this.#e("/v1/payments/lightning/invoice",{method:"POST",auth:"bearer",body:{package_id:t},signal:e}),list:t=>this.#e("/v1/payments/topups",{auth:"bearer",signal:t}),get:(t,e)=>this.#e(`/v1/payments/topups/${encodeURIComponent(t)}`,{auth:"bearer",signal:e}),waitFor:async(t,e={})=>{let r=e.intervalMs??2e3,n=Date.now()+(e.timeoutMs??900*1e3);for(;;){e.signal?.throwIfAborted();try{let i=await this.payments.get(t,e.signal);if(e.onPoll?.(i),ft.has(i.status))return i}catch(i){if(i instanceof y&&i.code!=="network"||!(i instanceof y))throw i}if(Date.now()+r>n)throw new y("timeout",`top-up ${t} was still pending after the timeout`);await bt(r,e.signal)}}};referral={code:t=>this.#e("/v1/referral/code",{auth:"bearer",signal:t}),apply:(t,e)=>this.#e("/v1/referral/apply",{method:"POST",auth:"bearer",body:{code:t},signal:e}),earnings:t=>this.#e("/v1/referral/earnings",{auth:"bearer",signal:t}),referees:t=>this.#e("/v1/referral/referees",{auth:"bearer",signal:t})}};function mt(){if(!(typeof location>"u"))return`${location.origin}${location.pathname}${location.search}`}function qe(s){if(s.url!==void 0){let e=s.url,r=e.indexOf("#"),n=e.indexOf("?"),i=r>=0?e.slice(r+1):"",h=n>=0&&(r<0||n<r)?e.slice(n+1,r>=0?r:void 0):"",d=new URLSearchParams(i),u=new URLSearchParams(h);return{get:g=>d.get(g)??u.get(g)}}let t=s.hash??(typeof location>"u"?"":location.hash);return new URLSearchParams(t.replace(/^#/,""))}function gt(s,t){return qe(s).get(t)}function bt(s,t){return new Promise((e,r)=>{let n=setTimeout(()=>{t?.removeEventListener("abort",i),e()},s),i=()=>{clearTimeout(n),r(t?.reason??new Error("aborted"))};t?.addEventListener("abort",i,{once:!0})})}var V=null;function De(s){return V=new B(s),k(),V}function vt(){return V}function He(s,t){if(s)return s;if(V)return V;if(t)return De({baseUrl:t});throw new Error("no OpenApps client: call configure({ baseUrl }) or set base-url on the element")}var me=new Set;function ge(s){return me.add(s),()=>me.delete(s)}function k(){for(let s of me)s()}var ae=globalThis,oe=ae.ShadowRoot&&(ae.ShadyCSS===void 0||ae.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,be=Symbol(),Ge=new WeakMap,K=class{constructor(t,e,r){if(this._$cssResult$=!0,r!==be)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o,e=this.t;if(oe&&t===void 0){let r=e!==void 0&&e.length===1;r&&(t=Ge.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),r&&Ge.set(e,t))}return t}toString(){return this.cssText}},je=s=>new K(typeof s=="string"?s:s+"",void 0,be),w=(s,...t)=>{let e=s.length===1?s[0]:t.reduce((r,n,i)=>r+(a=>{if(a._$cssResult$===!0)return a.cssText;if(typeof a=="number")return a;throw Error("Value passed to 'css' function must be a 'css' function result: "+a+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(n)+s[i+1],s[0]);return new K(e,s,be)},Fe=(s,t)=>{if(oe)s.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let e of t){let r=document.createElement("style"),n=ae.litNonce;n!==void 0&&r.setAttribute("nonce",n),r.textContent=e.cssText,s.appendChild(r)}},ve=oe?s=>s:s=>s instanceof CSSStyleSheet?(t=>{let e="";for(let r of t.cssRules)e+=r.cssText;return je(e)})(s):s;var{is:yt,defineProperty:wt,getOwnPropertyDescriptor:kt,getOwnPropertyNames:$t,getOwnPropertySymbols:xt,getPrototypeOf:_t}=Object,le=globalThis,We=le.trustedTypes,St=We?We.emptyScript:"",Ct=le.reactiveElementPolyfillSupport,J=(s,t)=>s,Y={toAttribute(s,t){switch(t){case Boolean:s=s?St:null;break;case Object:case Array:s=s==null?s:JSON.stringify(s)}return s},fromAttribute(s,t){let e=s;switch(t){case Boolean:e=s!==null;break;case Number:e=s===null?null:Number(s);break;case Object:case Array:try{e=JSON.parse(s)}catch{e=null}}return e}},ce=(s,t)=>!yt(s,t),Be={attribute:!0,type:String,converter:Y,reflect:!1,useDefault:!1,hasChanged:ce};Symbol.metadata??=Symbol("metadata"),le.litPropertyMetadata??=new WeakMap;var A=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=Be){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){let r=Symbol(),n=this.getPropertyDescriptor(t,r,e);n!==void 0&&wt(this.prototype,t,n)}}static getPropertyDescriptor(t,e,r){let{get:n,set:i}=kt(this.prototype,t)??{get(){return this[e]},set(a){this[e]=a}};return{get:n,set(a){let h=n?.call(this);i?.call(this,a),this.requestUpdate(t,h,r)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??Be}static _$Ei(){if(this.hasOwnProperty(J("elementProperties")))return;let t=_t(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(J("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(J("properties"))){let e=this.properties,r=[...$t(e),...xt(e)];for(let n of r)this.createProperty(n,e[n])}let t=this[Symbol.metadata];if(t!==null){let e=litPropertyMetadata.get(t);if(e!==void 0)for(let[r,n]of e)this.elementProperties.set(r,n)}this._$Eh=new Map;for(let[e,r]of this.elementProperties){let n=this._$Eu(e,r);n!==void 0&&this._$Eh.set(n,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){let e=[];if(Array.isArray(t)){let r=new Set(t.flat(1/0).reverse());for(let n of r)e.unshift(ve(n))}else t!==void 0&&e.push(ve(t));return e}static _$Eu(t,e){let r=e.attribute;return r===!1?void 0:typeof r=="string"?r:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){let t=new Map,e=this.constructor.elementProperties;for(let r of e.keys())this.hasOwnProperty(r)&&(t.set(r,this[r]),delete this[r]);t.size>0&&(this._$Ep=t)}createRenderRoot(){let t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Fe(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,r){this._$AK(t,r)}_$ET(t,e){let r=this.constructor.elementProperties.get(t),n=this.constructor._$Eu(t,r);if(n!==void 0&&r.reflect===!0){let i=(r.converter?.toAttribute!==void 0?r.converter:Y).toAttribute(e,r.type);this._$Em=t,i==null?this.removeAttribute(n):this.setAttribute(n,i),this._$Em=null}}_$AK(t,e){let r=this.constructor,n=r._$Eh.get(t);if(n!==void 0&&this._$Em!==n){let i=r.getPropertyOptions(n),a=typeof i.converter=="function"?{fromAttribute:i.converter}:i.converter?.fromAttribute!==void 0?i.converter:Y;this._$Em=n;let h=a.fromAttribute(e,i.type);this[n]=h??this._$Ej?.get(n)??h,this._$Em=null}}requestUpdate(t,e,r,n=!1,i){if(t!==void 0){let a=this.constructor;if(n===!1&&(i=this[t]),r??=a.getPropertyOptions(t),!((r.hasChanged??ce)(i,e)||r.useDefault&&r.reflect&&i===this._$Ej?.get(t)&&!this.hasAttribute(a._$Eu(t,r))))return;this.C(t,e,r)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:r,reflect:n,wrapped:i},a){r&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,a??e??this[t]),i!==!0||a!==void 0)||(this._$AL.has(t)||(this.hasUpdated||r||(e=void 0),this._$AL.set(t,e)),n===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[n,i]of this._$Ep)this[n]=i;this._$Ep=void 0}let r=this.constructor.elementProperties;if(r.size>0)for(let[n,i]of r){let{wrapped:a}=i,h=this[n];a!==!0||this._$AL.has(n)||h===void 0||this.C(n,void 0,i,h)}}let t=!1,e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(r=>r.hostUpdate?.()),this.update(e)):this._$EM()}catch(r){throw t=!1,this._$EM(),r}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};A.elementStyles=[],A.shadowRootOptions={mode:"open"},A[J("elementProperties")]=new Map,A[J("finalized")]=new Map,Ct?.({ReactiveElement:A}),(le.reactiveElementVersions??=[]).push("2.1.2");var Se=globalThis,Ve=s=>s,de=Se.trustedTypes,Ke=de?de.createPolicy("lit-html",{createHTML:s=>s}):void 0,et="$lit$",R=`lit$${Math.random().toFixed(9).slice(2)}$`,tt="?"+R,Et=`<${tt}>`,I=document,Z=()=>I.createComment(""),X=s=>s===null||typeof s!="object"&&typeof s!="function",Ce=Array.isArray,Pt=s=>Ce(s)||typeof s?.[Symbol.iterator]=="function",ye=`[ 	
\f\r]`,Q=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Je=/-->/g,Ye=/>/g,U=RegExp(`>|${ye}(?:([^\\s"'>=/]+)(${ye}*=${ye}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Qe=/'/g,Ze=/"/g,rt=/^(?:script|style|textarea|title)$/i,Ee=s=>(t,...e)=>({_$litType$:s,strings:t,values:e}),o=Ee(1),he=Ee(2),dr=Ee(3),z=Symbol.for("lit-noChange"),l=Symbol.for("lit-nothing"),Xe=new WeakMap,O=I.createTreeWalker(I,129);function st(s,t){if(!Ce(s)||!s.hasOwnProperty("raw"))throw Error("invalid template strings array");return Ke!==void 0?Ke.createHTML(t):t}var At=(s,t)=>{let e=s.length-1,r=[],n,i=t===2?"<svg>":t===3?"<math>":"",a=Q;for(let h=0;h<e;h++){let d=s[h],u,g,f=-1,S=0;for(;S<d.length&&(a.lastIndex=S,g=a.exec(d),g!==null);)S=a.lastIndex,a===Q?g[1]==="!--"?a=Je:g[1]!==void 0?a=Ye:g[2]!==void 0?(rt.test(g[2])&&(n=RegExp("</"+g[2],"g")),a=U):g[3]!==void 0&&(a=U):a===U?g[0]===">"?(a=n??Q,f=-1):g[1]===void 0?f=-2:(f=a.lastIndex-g[2].length,u=g[1],a=g[3]===void 0?U:g[3]==='"'?Ze:Qe):a===Ze||a===Qe?a=U:a===Je||a===Ye?a=Q:(a=U,n=void 0);let N=a===U&&s[h+1].startsWith("/>")?" ":"";i+=a===Q?d+Et:f>=0?(r.push(u),d.slice(0,f)+et+d.slice(f)+R+N):d+R+(f===-2?h:N)}return[st(s,i+(s[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),r]},ee=class s{constructor({strings:t,_$litType$:e},r){let n;this.parts=[];let i=0,a=0,h=t.length-1,d=this.parts,[u,g]=At(t,e);if(this.el=s.createElement(u,r),O.currentNode=this.el.content,e===2||e===3){let f=this.el.content.firstChild;f.replaceWith(...f.childNodes)}for(;(n=O.nextNode())!==null&&d.length<h;){if(n.nodeType===1){if(n.hasAttributes())for(let f of n.getAttributeNames())if(f.endsWith(et)){let S=g[a++],N=n.getAttribute(f).split(R),se=/([.?@])?(.*)/.exec(S);d.push({type:1,index:i,name:se[2],strings:N,ctor:se[1]==="."?ke:se[1]==="?"?$e:se[1]==="@"?xe:H}),n.removeAttribute(f)}else f.startsWith(R)&&(d.push({type:6,index:i}),n.removeAttribute(f));if(rt.test(n.tagName)){let f=n.textContent.split(R),S=f.length-1;if(S>0){n.textContent=de?de.emptyScript:"";for(let N=0;N<S;N++)n.append(f[N],Z()),O.nextNode(),d.push({type:2,index:++i});n.append(f[S],Z())}}}else if(n.nodeType===8)if(n.data===tt)d.push({type:2,index:i});else{let f=-1;for(;(f=n.data.indexOf(R,f+1))!==-1;)d.push({type:7,index:i}),f+=R.length-1}i++}}static createElement(t,e){let r=I.createElement("template");return r.innerHTML=t,r}};function D(s,t,e=s,r){if(t===z)return t;let n=r!==void 0?e._$Co?.[r]:e._$Cl,i=X(t)?void 0:t._$litDirective$;return n?.constructor!==i&&(n?._$AO?.(!1),i===void 0?n=void 0:(n=new i(s),n._$AT(s,e,r)),r!==void 0?(e._$Co??=[])[r]=n:e._$Cl=n),n!==void 0&&(t=D(s,n._$AS(s,t.values),n,r)),t}var we=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){let{el:{content:e},parts:r}=this._$AD,n=(t?.creationScope??I).importNode(e,!0);O.currentNode=n;let i=O.nextNode(),a=0,h=0,d=r[0];for(;d!==void 0;){if(a===d.index){let u;d.type===2?u=new te(i,i.nextSibling,this,t):d.type===1?u=new d.ctor(i,d.name,d.strings,this,t):d.type===6&&(u=new _e(i,this,t)),this._$AV.push(u),d=r[++h]}a!==d?.index&&(i=O.nextNode(),a++)}return O.currentNode=I,n}p(t){let e=0;for(let r of this._$AV)r!==void 0&&(r.strings!==void 0?(r._$AI(t,r,e),e+=r.strings.length-2):r._$AI(t[e])),e++}},te=class s{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,r,n){this.type=2,this._$AH=l,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=r,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode,e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=D(this,t,e),X(t)?t===l||t==null||t===""?(this._$AH!==l&&this._$AR(),this._$AH=l):t!==this._$AH&&t!==z&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Pt(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==l&&X(this._$AH)?this._$AA.nextSibling.data=t:this.T(I.createTextNode(t)),this._$AH=t}$(t){let{values:e,_$litType$:r}=t,n=typeof r=="number"?this._$AC(t):(r.el===void 0&&(r.el=ee.createElement(st(r.h,r.h[0]),this.options)),r);if(this._$AH?._$AD===n)this._$AH.p(e);else{let i=new we(n,this),a=i.u(this.options);i.p(e),this.T(a),this._$AH=i}}_$AC(t){let e=Xe.get(t.strings);return e===void 0&&Xe.set(t.strings,e=new ee(t)),e}k(t){Ce(this._$AH)||(this._$AH=[],this._$AR());let e=this._$AH,r,n=0;for(let i of t)n===e.length?e.push(r=new s(this.O(Z()),this.O(Z()),this,this.options)):r=e[n],r._$AI(i),n++;n<e.length&&(this._$AR(r&&r._$AB.nextSibling,n),e.length=n)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){let r=Ve(t).nextSibling;Ve(t).remove(),t=r}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}},H=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,r,n,i){this.type=1,this._$AH=l,this._$AN=void 0,this.element=t,this.name=e,this._$AM=n,this.options=i,r.length>2||r[0]!==""||r[1]!==""?(this._$AH=Array(r.length-1).fill(new String),this.strings=r):this._$AH=l}_$AI(t,e=this,r,n){let i=this.strings,a=!1;if(i===void 0)t=D(this,t,e,0),a=!X(t)||t!==this._$AH&&t!==z,a&&(this._$AH=t);else{let h=t,d,u;for(t=i[0],d=0;d<i.length-1;d++)u=D(this,h[r+d],e,d),u===z&&(u=this._$AH[d]),a||=!X(u)||u!==this._$AH[d],u===l?t=l:t!==l&&(t+=(u??"")+i[d+1]),this._$AH[d]=u}a&&!n&&this.j(t)}j(t){t===l?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},ke=class extends H{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===l?void 0:t}},$e=class extends H{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==l)}},xe=class extends H{constructor(t,e,r,n,i){super(t,e,r,n,i),this.type=5}_$AI(t,e=this){if((t=D(this,t,e,0)??l)===z)return;let r=this._$AH,n=t===l&&r!==l||t.capture!==r.capture||t.once!==r.once||t.passive!==r.passive,i=t!==l&&(r===l||n);n&&this.element.removeEventListener(this.name,this,r),i&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}},_e=class{constructor(t,e,r){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=r}get _$AU(){return this._$AM._$AU}_$AI(t){D(this,t)}};var Tt=Se.litHtmlPolyfillSupport;Tt?.(ee,te),(Se.litHtmlVersions??=[]).push("3.3.3");var nt=(s,t,e)=>{let r=e?.renderBefore??t,n=r._$litPart$;if(n===void 0){let i=e?.renderBefore??null;r._$litPart$=n=new te(t.insertBefore(Z(),i),i,void 0,e??{})}return n._$AI(s),n};var Pe=globalThis,M=class extends A{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=nt(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return z}};M._$litElement$=!0,M.finalized=!0,Pe.litElementHydrateSupport?.({LitElement:M});var Nt=Pe.litElementPolyfillSupport;Nt?.({LitElement:M});(Pe.litElementVersions??=[]).push("4.2.2");var C=s=>(t,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(s,t)}):customElements.define(s,t)};var Rt={attribute:!0,type:String,converter:Y,reflect:!1,hasChanged:ce},Mt=(s=Rt,t,e)=>{let{kind:r,metadata:n}=e,i=globalThis.litPropertyMetadata.get(n);if(i===void 0&&globalThis.litPropertyMetadata.set(n,i=new Map),r==="setter"&&((s=Object.create(s)).wrapped=!0),i.set(e.name,s),r==="accessor"){let{name:a}=e;return{set(h){let d=t.get.call(this);t.set.call(this,h),this.requestUpdate(a,d,s,!0,h)},init(h){return h!==void 0&&this.C(a,void 0,s,h),h}}}if(r==="setter"){let{name:a}=e;return function(h){let d=this[a];t.call(this,h),this.requestUpdate(a,d,s,!0,h)}}throw Error("Unsupported decorator location: "+r)};function v(s){return(t,e)=>typeof e=="object"?Mt(s,t,e):((r,n,i)=>{let a=n.hasOwnProperty(i);return n.constructor.createProperty(i,r),a?Object.getOwnPropertyDescriptor(n,i):void 0})(s,t,e)}function p(s){return v({...s,state:!0,attribute:!1})}var m=class extends M{constructor(){super(...arguments);this.error=null;this.busy=!1}#r;connectedCallback(){super.connectedCallback(),this.#r=ge(()=>this.onSessionChange())}disconnectedCallback(){this.#r?.(),super.disconnectedCallback()}onSessionChange(){this.requestUpdate()}get sdk(){return He(this.client,this.baseUrl)}get sdkOrNull(){try{return this.sdk}catch{return null}}async run(e){this.error=null,this.busy=!0;try{return await e()}catch(r){if(r instanceof Error&&r.name==="AbortError")return;this.error=Lt(r);return}finally{this.busy=!1}}emit(e,r){this.dispatchEvent(new CustomEvent(e,{detail:r,bubbles:!0,composed:!0}))}static{this.baseStyles=w`
    :host {
      /* Fallback palette: the design system's light values, inlined. */
      --fb-card: #ffffff;
      --fb-subtle: #f8f8f7;
      --fb-hairline: #deded9;
      --fb-strong: #020202;
      --fb-body: #3d3d3d;
      --fb-muted: #656565;
      --fb-faint: #7c7c7c;
      --fb-brand: #00c896;
      --fb-selected: #e6f9f3;
      --fb-danger: #b3261e;

      display: block;
      font: var(--type-body, 400 15px/1.45 "Geist", system-ui, sans-serif);
      letter-spacing: var(--tracking-body, -0.005em);
      color: var(--text-body, var(--fb-body));
    }

    /* Only the *fallbacks* follow the OS. Once tokens are linked, dark mode
       is the host's decision via the oa-auto / oa-dark classes, and a
       component running its own media query would sit stubbornly light
       inside a host that had deliberately forced dark. */
    @media (prefers-color-scheme: dark) {
      :host {
        --fb-card: #1a1a1a;
        --fb-subtle: #1a1a1a;
        --fb-hairline: rgba(255, 255, 255, 0.1);
        --fb-strong: #ffffff;
        --fb-body: rgba(255, 255, 255, 0.7);
        --fb-muted: rgba(255, 255, 255, 0.6);
        --fb-faint: rgba(255, 255, 255, 0.4);
        --fb-selected: #10312a;
        --fb-danger: #ff4d4d;
      }
    }

    /* ---- The SDK frame ----
       One card, capped at --sdk-max. It never assumes a page, so it drops
       into a modal, a settings pane, a phone screen or a route unchanged. */
    .panel {
      width: 100%;
      max-width: var(--sdk-max, 420px);
      background: var(--surface-card, var(--fb-card));
      border: var(--border-width, 1px) solid
        var(--border-hairline, var(--fb-hairline));
      border-radius: var(--radius-xl, 16px);
      box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.08));
      overflow: hidden;
      box-sizing: border-box;
    }

    .panel.wide {
      max-width: var(--sdk-wide, 560px);
    }

    .head {
      display: grid;
      gap: 8px;
      padding: 24px 24px 0;
    }

    .title {
      margin: 0;
      font: var(--weight-medium, 500) var(--text-xl, 24px) / 1.2
        var(--font-display, "Geist", system-ui, sans-serif);
      letter-spacing: var(--tracking-heading, -0.02em);
      color: var(--text-strong, var(--fb-strong));
    }

    .desc {
      margin: 0;
      font: var(--type-body, 400 15px/1.45 "Geist", system-ui, sans-serif);
      color: var(--text-muted, var(--fb-muted));
    }

    .body {
      display: grid;
      gap: 14px;
      padding: 24px;
    }

    /* A labelled rule, for "or" between a provider row and the rest. */
    .divider {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .divider::before,
    .divider::after {
      content: "";
      flex: 1;
      height: 1px;
      background: var(--border-hairline, var(--fb-hairline));
    }

    .caption {
      margin: 0;
      font: var(--type-caption, 400 12px/1.35 "Geist", system-ui, sans-serif);
      color: var(--text-faint, var(--fb-faint));
    }

    .eyebrow {
      font: var(--type-eyebrow, 500 12px/1.2 "Geist", system-ui, sans-serif);
      letter-spacing: var(--tracking-caps, 0.08em);
      text-transform: uppercase;
      color: var(--text-faint, var(--fb-faint));
    }

    /* The O monogram on a squircle. No logo was ever supplied, so the mark
       is typographic by design: legible at 16px, works in one colour, and
       re-skins from the --logo-* tokens without redrawing anything. */
    .mark {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: var(--logo-tile-radius, 0.22em);
      background: var(--logo-tile-bg, var(--fb-strong));
      color: var(--logo-tile-fg, var(--fb-brand));
      font: var(--weight-medium, 500) 18px / 1
        var(--font-display, "Geist", system-ui, sans-serif);
      letter-spacing: var(--logo-tracking, -0.04em);
      user-select: none;
    }

    /* A value the user is meant to copy: an address, an invoice, a link.
       Shared because three elements render one and a fourth will. */
    .payload {
      display: block;
      overflow-wrap: anywhere;
      padding: 0.6em;
      border: var(--border-width, 1px) solid
        var(--border-hairline, var(--fb-hairline));
      border-radius: var(--radius-lg, 12px);
      background: var(--bg-subtle, var(--fb-subtle));
      font: var(--type-mono, 400 13px/1.5 ui-monospace, monospace);
      color: var(--text-body, var(--fb-body));
    }

    /* ---- Badge ----
       A read-only status pill. Never given a click handler: a badge that
       does something is a control wearing a status's clothes. */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 22px;
      padding: 0 8px;
      border-radius: var(--radius-full, 999px);
      font: var(--weight-medium, 500) var(--text-xs, 12px) / 1
        var(--font-sans, "Geist", system-ui, sans-serif);
      white-space: nowrap;
      background: var(--bg-sunken, #f2f2f2);
      color: var(--text-muted, var(--fb-muted));
    }

    .badge.success {
      background: var(--success-bg, #e6f9f3);
      color: var(--success-fg, #0b8a68);
    }

    .badge.danger {
      background: var(--danger-bg, #fdecea);
      color: var(--danger-fg, var(--fb-danger));
    }

    .badge.brand {
      background: var(--brand-soft, #e6f9f3);
      color: var(--text-brand, var(--fb-brand));
    }

    /* Inherits the pill's colour, so a tone change carries the dot with it. */
    .badge .dot {
      width: 5px;
      height: 5px;
      border-radius: var(--radius-full, 999px);
      background: currentColor;
    }

    /* ---- Field ----
       Label, control, hint. Focus is a near-black border plus the offset
       ring — never a coloured glow, and never a removed outline. */
    .field {
      display: grid;
      gap: 6px;
    }

    .field label {
      font: var(--type-ui, 500 13px/1.3 "Geist", system-ui, sans-serif);
      color: var(--text-strong, var(--fb-strong));
    }

    .field input {
      width: 100%;
      box-sizing: border-box;
      min-height: var(--control-h-md, 36px);
      padding: 0 12px;
      border: var(--border-width, 1px) solid
        var(--border-hairline, var(--fb-hairline));
      border-radius: var(--radius-md, 8px);
      background: var(--surface-card, var(--fb-card));
      color: var(--text-strong, var(--fb-strong));
      font: var(--type-body, 400 15px/1.45 "Geist", system-ui, sans-serif);
      letter-spacing: inherit;
    }

    .field input::placeholder {
      color: var(--text-faint, var(--fb-faint));
    }

    .field input:focus-visible {
      border-color: var(--text-strong, var(--fb-strong));
      box-shadow: var(--focus-ring, 0 0 0 2px #f2f2f2, 0 0 0 4px #020202);
    }

    .field .hint {
      font: var(--type-caption, 400 12px/1.35 "Geist", system-ui, sans-serif);
      color: var(--text-faint, var(--fb-faint));
    }

    /* Anything numeric — balances, prices, per-unit rates, ledger amounts. */
    .mono {
      font-family: var(--font-mono, "Geist Mono", ui-monospace, monospace);
      font-variant-numeric: tabular-nums;
    }

    /* ---- Controls ----
       Height comes from the platform tokens, which re-point themselves under
       a pointer:coarse media query, so touch targets clear 44px with no
       mobile-specific variant here. */
    button {
      font: var(--type-ui, 500 13px/1.3 "Geist", system-ui, sans-serif);
      letter-spacing: inherit;
      cursor: pointer;
      min-height: var(--control-h-md, 36px);
      padding: 0 14px;
      border-radius: var(--radius-md, 8px);
      border: var(--border-width, 1px) solid
        var(--border-hairline, var(--fb-hairline));
      background: var(--surface-card, var(--fb-card));
      color: var(--text-strong, var(--fb-strong));
      transition: var(--transition-control, all 120ms cubic-bezier(0.2, 0, 0, 1));
    }

    button:hover:not([disabled]) {
      background: var(--surface-hover, rgba(0, 0, 0, 0.04));
    }

    /* The whole press feedback is half a pixel. Nothing scales. */
    button:active:not([disabled]) {
      transform: translateY(0.5px);
    }

    button.primary {
      background: var(--brand, var(--fb-brand));
      border-color: var(--brand, var(--fb-brand));
      color: var(--brand-contrast, #020202);
    }

    button.primary:hover:not([disabled]) {
      background: var(--brand-soft, #1ad3a5);
    }

    button.ghost {
      background: transparent;
      border-color: transparent;
    }

    button.block {
      width: 100%;
      justify-content: center;
    }

    button[disabled] {
      opacity: 0.45;
      cursor: not-allowed;
    }

    /* A ring, never a glow, and never removed. */
    :focus-visible {
      outline: none;
      box-shadow: var(--focus-ring, 0 0 0 2px #f2f2f2, 0 0 0 4px #020202);
    }

    a {
      color: var(--text-link, var(--fb-strong));
      text-decoration: none;
      text-underline-offset: 3px;
    }

    a:hover {
      text-decoration: underline;
    }

    .error {
      color: var(--danger-fg, var(--fb-danger));
      font: var(--type-caption, 400 12px/1.35 "Geist", system-ui, sans-serif);
      margin-top: 0.5em;
    }

    .muted {
      color: var(--text-muted, var(--fb-muted));
    }
  `}};c([v({type:String,attribute:"base-url"})],m.prototype,"baseUrl",2),c([v({attribute:!1})],m.prototype,"client",2),c([p()],m.prototype,"error",2),c([p()],m.prototype,"busy",2);function Lt(s){if(s instanceof y)switch(s.code){case"unauthorized":return"Please sign in again.";case"insufficient_balance":return s.balance===void 0?"Not enough credits.":`Not enough credits \u2014 you have ${s.balance}.`;case"rate_limited":return"Too many attempts. Please wait a moment and try again.";case"network":return"Could not reach the server. Check your connection.";case"timeout":return"This is taking longer than expected. It may still complete.";default:return s.message}return s instanceof Error?s.message:String(s)}var it=he`<svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.909c1.702-1.567 2.683-3.874 2.683-6.614z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.909-2.258c-.806.54-1.837.859-3.047.859-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.346l2.582-2.582C13.463.892 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>`,at=he`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><g fill="#627EEA"><path d="M12 1.5 5.75 12.02 12 15.73V1.5z" opacity=".55"/><path d="M12 1.5v14.23l6.25-3.71L12 1.5z" opacity=".85"/><path d="M12 17.06 5.75 13.35 12 22.5v-5.44z" opacity=".55"/><path d="M12 22.5v-5.44l6.25-3.71L12 22.5z" opacity=".85"/></g></svg>`,ot=he`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="#9C59FF" d="M3 23.9C2.7 23.6 2.8 22.7 3.3 22.1C3.4 21.9 3.4 21.9 3.2 21.9C3 22 2.9 21.9 2.9 21.6C3 21.3 3.4 21 3.9 20.9C4.4 20.8 4.4 20.8 5.2 19.5C5.7 18.9 6.3 18.1 6.5 17.7C6.9 17.2 7 17 7.1 16.8C7.2 16.3 7.4 16 7.9 15.8C8.5 15.6 10.4 13.8 10.2 13.6C10.2 13.6 10 13.6 9.7 13.5C8.7 13.3 7.5 12.8 6.9 12.4C6.6 12.2 6.6 12.2 6.4 12.2C5.6 12.3 4.9 12.5 4.4 12.8C3.8 13.1 3.8 13.2 3.7 13.1C3.6 13 3.6 12.4 3.8 12C3.8 11.9 3.8 11.9 3.7 11.9C3.6 11.9 3.4 12 3.1 12.3C2.7 12.8 2.6 12.8 2.5 12.6C2.3 12.4 2.4 12.1 2.5 11.7C2.6 11.2 2.6 11.2 2.5 11.2C2.4 11.3 2.2 11.4 2 11.4C1.6 11.6 1.5 11.6 1.5 11.4C1.5 10.7 2.3 9.7 3 9.3C3.7 8.9 4.9 8.8 5.2 9C5.3 9.1 5.6 9.2 5.6 9.2C5.6 9.2 5.6 9.1 5.5 9C5.4 8.8 5.4 8.6 5.5 8.6C5.5 8.6 5.9 8.6 6.3 8.6C7.6 8.6 8.1 8.4 9.4 7.8C10.9 7.1 11.1 7 11.7 6.8C12.5 6.5 12.9 6.4 13.9 6.4C15.4 6.3 16 6.5 17.4 7.3C18 7.7 18.1 7.7 18.4 7.6C18.7 7.6 18.8 7.6 19.1 7.6C19.7 7.7 20 7.7 20.4 7.5C21.1 7.1 21.4 6.5 21.3 5.7C21.3 5 21.1 4.7 20.2 4.1C19.1 3.2 18.7 2.5 18.7 1.5C18.7 0.9 18.8 0.6 19.1 0.3C19.5 -0.1 19.9 -0.1 20.6 0.4C21 0.6 21.2 0.7 21.8 0.9C22.6 1.2 22.7 1.2 22.2 1.3C21.8 1.3 21.8 1.3 22.1 1.4C22.7 1.6 22.6 1.7 21.7 1.7C21.1 1.7 20.9 1.7 20.6 1.8C20.1 1.9 20 2 20.1 2.2C20.1 2.5 20.2 2.6 20.9 3.1C22.1 4.1 22.5 4.8 22.5 6C22.4 7.5 21.5 8.7 19.8 9.8C19.2 10.1 19.2 10.1 19.2 10.7C19.2 11.9 19 12.5 18.3 13.1C17.5 13.7 16.6 13.9 15.1 14L14.3 14L14.2 14.2C14.1 14.2 14.1 14.3 14.1 14.4C14.1 14.4 13.8 14.6 13.5 14.8C13.2 15 12.6 15.8 12.9 15.7C12.9 15.7 13.4 15.5 14 15.3C17 14.4 16.7 14.5 17.2 14.5C17.8 14.5 17.8 14.5 18.4 15.4C19 16.3 19.1 16.5 19 16.6C19 16.8 18.5 16.6 18 16.1C17.7 15.8 17.6 15.8 17.7 16.1C17.7 16.4 17.6 16.5 17.4 16.4C17.3 16.3 17.2 16.2 17.1 15.8L17.1 15.5L16.9 15.5C16.6 15.5 16.6 15.5 14.5 16.2C13.3 16.6 12.9 16.7 12.7 16.9C12 17.2 11.5 17 11.5 16.3C11.5 16.1 11.9 14.9 12.1 14.8C12.1 14.8 12.3 14.4 12.2 14.4C12.2 14.4 11.9 14.5 11.6 14.6L11 14.8L10 15.6C9 16.4 9 16.4 8.9 16.6C8.8 17 8.5 17.3 8.1 17.4C7.9 17.5 7.8 17.7 6.9 18.8C5.9 20.1 5.3 20.9 4.9 21.6C4.8 21.8 4.5 22.1 4.3 22.4C3.7 22.9 3.6 23.1 3.3 23.6C3.1 24 3.1 24 3 23.9Z"/></svg>`;var b=class extends Error{constructor(t){super(t),this.name="WalletError"}};function lt(){return typeof window>"u"?[]:[{where:"window.nostr",provider:window.nostr},{where:"window.okxwallet.nostr",provider:window.okxwallet?.nostr}]}function Ut(s){let t=s;return!!t&&typeof t.getPublicKey=="function"&&typeof t.signEvent=="function"}function Ae(){for(let{provider:s}of lt())if(Ut(s))return s;return null}async function pe(s=2e3){let t=Date.now()+s;for(;;){let e=Ae();if(e)return e;let r=t-Date.now();if(r<=0)return null;await new Promise(n=>setTimeout(n,Math.min(100,r)))}}function Te(){return lt().map(s=>s.where)}function Ne(){if(typeof window>"u")return null;for(let s of[window.ethereum,window.okxwallet])if(s&&typeof s.request=="function")return s;return null}function Ot(){return Ne()!==null}function It(){return Ae()!==null}function zt(){let s=[];return Ot()&&s.push("eip155"),It()&&s.push("nostr"),s}async function Re(s,t){let e;try{e=JSON.parse(s)}catch{throw new b("server sent an unreadable Nostr challenge")}let{nip19:r,finalizeEvent:n}=await import("./esm-4FLLMH4O.js"),i;try{let a=r.decode(t.trim());if(a.type!=="nsec")throw new b(`that is an ${a.type} key \u2014 sign-in needs the secret key, which starts with nsec1`);i=a.data}catch(a){throw a instanceof b?a:new b("that does not look like a valid nsec1\u2026 key")}try{let a=n({kind:e.kind,content:e.content,tags:e.tags,created_at:e.created_at??Math.floor(Date.now()/1e3)},i);return{type:"nostr_event",event:JSON.stringify(a)}}finally{i.fill(0)}}async function G(){let s=Ne();if(!s)throw new b("no Ethereum wallet found in this browser");let t;try{t=await s.request({method:"eth_requestAccounts"})}catch(r){throw new b(Le(r,"wallet connection was rejected"))}let e=Array.isArray(t)?t[0]:void 0;if(typeof e!="string"||!e)throw new b("wallet returned no accounts");return e}async function j(s,t){let e=Ne();if(!e)throw new b("no Ethereum wallet found in this browser");try{let r=await e.request({method:"personal_sign",params:[s,t]});if(typeof r!="string")throw new b("wallet returned no signature");return{type:"signature",signature:r}}catch(r){throw r instanceof b?r:new b(Le(r,"signature was rejected"))}}async function F(s){let t=await pe();if(!t)throw new b(`no Nostr signer answered (looked at ${Te().join(", ")})`);let e;try{e=JSON.parse(s)}catch{throw new b("server sent an unreadable Nostr challenge")}e.created_at??=Math.floor(Date.now()/1e3);try{let r=await t.signEvent(e);return{type:"nostr_event",event:JSON.stringify(r)}}catch(r){throw new b(Le(r,"signing was rejected"))}}var qt=6e4;async function Me(s,t,e={}){let r;try{r=JSON.parse(s)}catch{throw new b("server sent an unreadable Nostr challenge")}let[{BunkerSigner:n,parseBunkerInput:i},{generateSecretKey:a}]=await Promise.all([import("./nip46-BUEVRFDS.js"),import("./pure-MYJTDKMF.js")]),h=await i(t.trim()).catch(()=>null);if(!h)throw new b("that is not a bunker:// address or a NIP-05 name \u2014 copy the connection string from your signer app");let d=n.fromBunker(a(),h,{onauth:u=>e.onAuthUrl?.(u)});try{let u=await Dt((async()=>(await d.connect(),d.signEvent({kind:r.kind,content:r.content,tags:r.tags,created_at:r.created_at??Math.floor(Date.now()/1e3)})))(),e.timeoutMs??qt,"the signer did not respond \u2014 check it is running and try again");return{type:"nostr_event",event:JSON.stringify(u)}}catch(u){throw u instanceof b?u:new b(u instanceof Error?u.message:"the remote signer refused")}finally{await d.close().catch(()=>{})}}function Dt(s,t,e){return new Promise((r,n)=>{let i=setTimeout(()=>n(new b(e)),t);s.then(a=>{clearTimeout(i),r(a)},a=>{clearTimeout(i),n(a)})})}function Le(s,t){if(s&&typeof s=="object"){let e=s;if(e.code===4001)return t;if(e.message)return e.message}return t}var $=class extends m{constructor(){super(...arguments);this.me=null;this.enabled=null;this.signerTimeout=2e3;this.variant="inline";this.nostrFallback="none";this.nostrHint=null;this.authUrl=null}connectedCallback(){super.connectedCallback(),this.load()}onSessionChange(){this.load()}async load(){let e=await this.run(()=>this.sdk.auth.completeRedirect());if(e&&(this.emit("openapps-login",e),k()),this.enabled||(this.enabled=await this.run(()=>this.sdk.auth.methods())??null),!this.sdk.isLoggedIn){this.me=null;return}this.me=await this.run(()=>this.sdk.auth.me())??null}async loginWithWallet(){await this.run(async()=>{let e=await G(),r=await this.sdk.auth.challenge("eip155",e),n=await j(r.message,e),i=await this.sdk.auth.verify(r.challenge_id,n,{referralCode:re()});this.emit("openapps-login",i),k()})}async loginWithNostr(){if(!await pe(this.signerTimeout)){this.nostrFallback="bunker",this.nostrHint=`No signer extension answered. Checked ${Te().join(" and ")}. On a phone, or without an extension, connect a remote signer below.`;return}await this.run(async()=>{let e=await this.sdk.auth.challenge("nostr"),r=await F(e.message),n=await this.sdk.auth.verify(e.challenge_id,r,{referralCode:re()});this.emit("openapps-login",n),k()})}async loginWithBunker(e){e.preventDefault();let n=this.renderRoot.querySelector("#bunker")?.value.trim()??"";n&&(this.authUrl=null,await this.run(async()=>{let i=await this.sdk.auth.challenge("nostr"),a=await Me(i.message,n,{onAuthUrl:d=>{this.authUrl=d}}),h=await this.sdk.auth.verify(i.challenge_id,a,{referralCode:re()});this.nostrFallback="none",this.authUrl=null,this.emit("openapps-login",h),k()}))}async loginWithNsec(e){e.preventDefault();let r=this.renderRoot.querySelector("#nsec"),n=r?.value.trim()??"";n&&await this.run(async()=>{try{let i=await this.sdk.auth.challenge("nostr"),a=await Re(i.message,n),h=await this.sdk.auth.verify(i.challenge_id,a,{referralCode:re()});this.nostrFallback="none",this.emit("openapps-login",h),k()}finally{r&&(r.value="")}})}loginWithGoogle(){let e=`${location.origin}${location.pathname}${location.search}`;window.location.href=this.sdk.auth.googleStartUrl(e,re())}async logout(){await this.run(()=>this.sdk.auth.logout()),this.me=null,this.emit("openapps-logout",null),k()}render(){if(this.me)return this.renderSignedIn(this.me);let e=this.enabled?.google??!1,r=this.enabled?.eip155??!1,n=this.enabled?.nostr??!1;if(this.enabled&&!e&&!r&&!n)return this.frame(o`
        <p class="muted">This server has no login methods configured.</p>
        ${this.error?o`<p class="error" role="alert">${this.error}</p>`:l}
      `);let i=this.variant==="panel"?"block":"";return this.frame(o`
      <div class="stack">
        ${e?o`<button
              class="provider ${i}"
              ?disabled=${this.busy}
              @click=${this.loginWithGoogle}
            >
              ${it}<span>Continue with Google</span>
            </button>`:l}
        ${r?o`<button
              class="provider ${i}"
              ?disabled=${this.busy}
              @click=${this.loginWithWallet}
            >
              ${at}<span>Continue with a wallet</span>
            </button>`:l}
        ${n?o`
              <button
                class="provider ${i}"
                ?disabled=${this.busy}
                @click=${this.loginWithNostr}
              >
                ${ot}<span>Continue with Nostr</span>
              </button>
              ${this.renderNostrFallback()}
            `:l}
        ${this.error?o`<p class="error" role="alert">${this.error}</p>`:l}
      </div>
    `)}frame(e){return this.variant!=="panel"?e:o`
      <div class="panel">
        <div class="head">
          <span class="mark" aria-hidden="true">O</span>
          <h1 class="title">Sign in to OpenApps</h1>
          <p class="desc">
            One account for every app in the suite. Optional — the apps work
            without it.
          </p>
        </div>
        <div class="body">${e}</div>
      </div>
    `}renderNostrFallback(){return this.nostrFallback==="bunker"?this.renderBunkerForm():this.nostrFallback==="nsec"?this.renderNsecForm():o`
      <button
        class="link"
        ?disabled=${this.busy}
        @click=${()=>{this.nostrFallback="bunker",this.nostrHint=null}}
      >
        No extension? Use a remote signer
      </button>
    `}renderBunkerForm(){return o`
      <form class="nsec" @submit=${this.loginWithBunker}>
        ${this.nostrHint?o`<p class="muted small">${this.nostrHint}</p>`:l}
        <p class="muted small">
          Paste the connection string from your signer — Amber, nsec.app, or your
          own bunker. It looks like <code>bunker://…</code>, or you can use a
          NIP-05 name. <strong>Your key never leaves the signer</strong>; only the
          request to sign travels, and you approve it there.
        </p>
        <div class="field">
          <label for="bunker">Remote signer</label>
          <input
            id="bunker"
            type="text"
            placeholder="bunker://… or you@example.com"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            ?disabled=${this.busy}
          />
          <span class="hint">
            A bunker URI, or the NIP-05 address your signer is reachable at.
          </span>
        </div>
        ${this.authUrl?o`<p class="muted small">
              Your signer needs approval:
              <a href=${this.authUrl} target="_blank" rel="noreferrer noopener"
                >open it</a
              >, then come back.
            </p>`:l}
        <div class="row">
          <button class="primary" type="submit" ?disabled=${this.busy}>
            ${this.busy?"Waiting for your signer\u2026":"Connect signer"}
          </button>
          <button
            type="button"
            ?disabled=${this.busy}
            @click=${()=>this.nostrFallback="none"}
          >
            Cancel
          </button>
        </div>
        <button
          class="link"
          type="button"
          ?disabled=${this.busy}
          @click=${()=>{this.nostrFallback="nsec",this.nostrHint=null}}
        >
          I only have a private key
        </button>
      </form>
    `}renderNsecForm(){return o`
      <form class="nsec" @submit=${this.loginWithNsec}>
        ${this.nostrHint?o`<p class="muted small">${this.nostrHint}</p>`:l}
        <p class="warn">
          <strong>Only do this on a key you can afford to lose.</strong>
          An <code>nsec</code> is your whole Nostr identity — it cannot be changed
          without abandoning the account, and any script on this page can read it
          while you paste it. A signer extension exists so a website never sees
          your key.
        </p>
        <div class="field">
          <label for="nsec">Secret key</label>
          <input
            id="nsec"
            type="password"
            placeholder="nsec1…"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            ?disabled=${this.busy}
          />
        </div>
        <p class="muted small">
          The key is used in this browser to sign one message. It is not sent to
          the server and not saved anywhere.
        </p>
        <div class="row">
          <button class="primary" type="submit" ?disabled=${this.busy}>
            Sign in
          </button>
          <button type="button" ?disabled=${this.busy} @click=${()=>this.nostrFallback="none"}>
            Cancel
          </button>
        </div>
      </form>
    `}renderSignedIn(e){let r=e.display_name??e.linked_accounts[0]?.caip10??e.id;return o`
      <div class="row">
        <span class="identity" title=${r}>${Ht(r)}</span>
        <button ?disabled=${this.busy} @click=${this.logout}>Sign out</button>
      </div>
      ${this.error?o`<p class="error" role="alert">${this.error}</p>`:l}
    `}};$.styles=[m.baseStyles,w`
      /* Mark on the left, label centred in the space that remains — so the
         three labels line up with each other rather than each sitting a
         different distance from its own icon. */
      button.provider {
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
      }
      button.provider svg {
        flex: none;
      }
      button.provider.block span {
        flex: 1;
        text-align: center;
        /* Balance the mark so the label is centred on the button, not on
           the space beside the mark. */
        margin-right: 26px;
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.75em;
      }
      .identity {
        font-variant-numeric: tabular-nums;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      button.link {
        border: none;
        background: none;
        color: var(--text-muted, var(--fb-muted));
        text-decoration: underline;
        padding: 0.1em 0;
        font-size: 0.85em;
        text-align: left;
      }
      .nsec {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        border: 1px solid var(--border-hairline, var(--fb-hairline));
        border-radius: var(--radius-lg, 12px);
        padding: 0.8em;
      }
      /* Everything else comes from .field. Only the family is overridden:
         a key is a literal, and mono carries literals. */
      .nsec input {
        font-family: var(--font-mono, "Geist Mono", ui-monospace, monospace);
      }
      /* Semantic tokens, so a host forcing dark gets the dark warning —
         the hardcoded pair here used its own media query and so ignored
         the host entirely. */
      .warn {
        font-size: 0.8rem;
        margin: 0;
        padding: 0.5em 0.6em;
        border-radius: var(--radius-lg, 12px);
        background: var(--warning-bg, #fef3c7);
        color: var(--warning-fg, #92400e);
      }
      .small {
        font-size: 0.78rem;
      }
      .row {
        display: flex;
        gap: 0.5em;
      }
    `],c([p()],$.prototype,"me",2),c([p()],$.prototype,"enabled",2),c([v({type:Number,attribute:"signer-timeout"})],$.prototype,"signerTimeout",2),c([v({type:String})],$.prototype,"variant",2),c([p()],$.prototype,"nostrFallback",2),c([p()],$.prototype,"nostrHint",2),c([p()],$.prototype,"authUrl",2),$=c([C("openapps-login")],$);function Ht(s,t=10,e=6){return s.length<=t+e+1?s:`${s.slice(0,t)}\u2026${s.slice(-e)}`}function re(){return typeof location>"u"?void 0:new URLSearchParams(location.search).get("ref")??void 0}var Ue={google:"Google",eip155:"Wallet",nostr:"Nostr"},P=class extends m{constructor(){super(...arguments);this.me=null;this.enabled=null;this.pending=null;this.notice=null;this.blocked=null}connectedCallback(){super.connectedCallback(),this.load()}onSessionChange(){this.load()}async load(){if(await Promise.resolve(),this.handleLinkRedirect(),this.enabled||(this.enabled=await this.run(()=>this.sdk.auth.methods())??null),!this.sdk.isLoggedIn){this.me=null;return}this.me=await this.run(()=>this.sdk.auth.me())??null}linked(e){return(this.me?.linked_accounts??[]).some(r=>r.namespace===e)}get connectable(){return["eip155","nostr"].filter(e=>this.enabled?.[e]&&!this.linked(e))}get canConnectGoogle(){return(this.enabled?.google??!1)&&!this.linked("google")}async connectGoogle(e=!1){await this.run(async()=>{let r=`${location.origin}${location.pathname}${location.search}`,n=await this.sdk.auth.googleLinkStart(r,{merge:e});window.location.href=n})}handleLinkRedirect(){let e;try{e=this.sdk.auth.completeLinkRedirect()}catch{return}if(e)switch(e.status){case"linked":this.notice=e.merged?`Accounts combined \u2014 ${e.credits.toLocaleString()} credits moved across.`:"Google connected.",this.emit("openapps-identity-linked",e),k();break;case"conflict":this.pending={namespace:"google",other:{id:"",balance:e.balance}};break;case"blocked":this.blocked=e.message;break;case"error":this.error=e.message;break}}async connect(e){this.blocked=null,await this.run(async()=>{let r=e==="eip155"?await G():void 0,n=await this.sdk.auth.linkChallenge(e,r),i=e==="eip155"?await j(n.message,r):await F(n.message);try{let a=await this.sdk.auth.linkVerify(n.challenge_id,i);this.afterLink(a)}catch(a){if(a instanceof y&&(a.detail?.code==="merge_blocked_by_duplicate_namespace"||a.detail?.code==="namespace_already_linked")){this.blocked=a.message;return}if(a instanceof y&&a.detail?.code==="identity_belongs_to_another_account"){this.pending={namespace:e,other:a.detail.other_account};return}throw a}})}async confirmMerge(){let e=this.pending;if(e){if(e.namespace==="google"){this.pending=null,await this.connectGoogle(!0);return}await this.run(async()=>{let r=e.namespace==="eip155"?await G():void 0,n=await this.sdk.auth.linkChallenge(e.namespace,r),i=e.namespace==="eip155"?await j(n.message,r):await F(n.message),a=await this.sdk.auth.linkVerify(n.challenge_id,i,{merge:!0});this.pending=null,this.afterLink(a)})}}afterLink(e){this.notice=e.merged?`Accounts combined \u2014 ${(e.credits_transferred??0).toLocaleString()} credits moved across.`:"Connected.",this.emit("openapps-identity-linked",e),k(),this.load()}async unlink(e){await this.run(async()=>{await this.sdk.auth.unlink(e),this.notice="Disconnected.",this.emit("openapps-identity-unlinked",{caip10:e}),await this.load()})}render(){if(!this.sdkOrNull)return o`<p class="muted">Loading…</p>`;if(!this.sdk.isLoggedIn)return o`<p class="muted">Sign in to manage your account.</p>`;if(!this.me)return o`<p class="muted">Loading…</p>`;if(this.pending)return this.renderMergePrompt(this.pending);let e=this.me.linked_accounts;return o`
      <div class="card">
        <div class="head">
          <div>
            <div class="muted small">Account</div>
            <code class="id">${this.me.id}</code>
          </div>
          <div class="right">
            <div class="balance">${this.me.balance.toLocaleString()}</div>
            <div class="muted small">credits</div>
          </div>
        </div>

        <h3>Sign-in methods</h3>
        <ul class="identities">
          ${e.map(r=>o`
              <li>
                <span class="tag">${Ue[r.namespace]??r.namespace}</span>
                <code title=${r.caip10}
                  >${Gt(r.label??r.caip10)}</code
                >
                ${e.length>1?o`<button
                      class="link"
                      ?disabled=${this.busy}
                      @click=${()=>this.unlink(r.caip10)}
                    >
                      Disconnect
                    </button>`:o`<span class="muted small">only method</span>`}
              </li>
            `)}
        </ul>

        ${this.connectable.length||this.canConnectGoogle?o`
              <h3>Add another</h3>
              <div class="row">
                ${this.canConnectGoogle?o`<button ?disabled=${this.busy} @click=${()=>this.connectGoogle()}>
                      Connect Google
                    </button>`:l}
                ${this.connectable.map(r=>o`
                    <button ?disabled=${this.busy} @click=${()=>this.connect(r)}>
                      Connect ${Ue[r]}
                    </button>
                  `)}
              </div>
              <p class="muted small">
                Connecting a method that is already on another account will offer to
                combine them, so you keep one balance and one history.
              </p>
            `:o`<p class="muted small">Every available method is connected.</p>`}

        ${this.blocked?o`<p class="warn" role="alert">${this.blocked}</p>`:l}
        ${this.notice?o`<p class="notice">${this.notice}</p>`:l}
        ${this.error?o`<p class="error" role="alert">${this.error}</p>`:l}
      </div>
    `}renderMergePrompt(e){return o`
      <div class="card">
        <h3>Combine two accounts?</h3>
        <p>
          That ${Ue[e.namespace]??e.namespace} identity already
          belongs to another account holding
          <strong>${e.other.balance.toLocaleString()} credits</strong>.
        </p>
        <p class="muted small">
          Combining moves its credits, payment history and referral earnings onto
          this account, and signs it out everywhere. It cannot be undone.
        </p>
        <div class="row">
          <button class="primary" ?disabled=${this.busy} @click=${this.confirmMerge}>
            Combine them
          </button>
          <button ?disabled=${this.busy} @click=${()=>this.pending=null}>
            Cancel
          </button>
        </div>
        ${this.error?o`<p class="error" role="alert">${this.error}</p>`:l}
      </div>
    `}};P.styles=[m.baseStyles,w`
      .card {
        border: 1px solid var(--border-hairline, var(--fb-hairline));
        border-radius: var(--radius-lg, 12px);
        padding: 1rem 1.1rem;
        background: var(--surface-card, var(--fb-card));
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        border-bottom: 1px solid var(--border-hairline, var(--fb-hairline));
        padding-bottom: 0.75rem;
      }
      .right {
        text-align: right;
      }
      .balance {
        font-size: 1.5rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .id {
        font-size: 0.8rem;
        overflow-wrap: anywhere;
      }
      h3 {
        font-size: 0.9rem;
        margin: 1rem 0 0.5rem;
      }
      .identities {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .identities li {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.9rem;
      }
      .identities code {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tag {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border: 1px solid var(--border-hairline, var(--fb-hairline));
        border-radius: 999px;
        padding: 0.1em 0.6em;
      }
      button.link {
        border: none;
        background: none;
        color: var(--text-muted, var(--fb-muted));
        text-decoration: underline;
        padding: 0;
        font-size: 0.85em;
      }
      .row {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .small {
        font-size: 0.8rem;
      }
      .notice {
        font-size: 0.85rem;
        margin-top: 0.6rem;
      }
      /* Semantic tokens rather than a hardcoded pair with its own media
         query: that combination ignored the host entirely, so a page
         forcing dark kept a bright yellow warning. */
      .warn {
        font-size: 0.85rem;
        margin-top: 0.6rem;
        padding: 0.5em 0.7em;
        border-radius: var(--radius-lg, 12px);
        background: var(--warning-bg, #fef3c7);
        color: var(--warning-fg, #92400e);
      }
    `],c([p()],P.prototype,"me",2),c([p()],P.prototype,"enabled",2),c([p()],P.prototype,"pending",2),c([p()],P.prototype,"notice",2),c([p()],P.prototype,"blocked",2),P=c([C("openapps-account")],P);function Gt(s,t=18,e=8){return s.length<=t+e+1?s:`${s.slice(0,t)}\u2026${s.slice(-e)}`}var W,T=class extends m{constructor(){super(...arguments);this.pollSeconds=0;this.label="Credits";this.balance=null;ne(this,W)}connectedCallback(){super.connectedCallback(),this.refresh(),this.pollSeconds>0&&ie(this,W,setInterval(()=>{this.refresh()},this.pollSeconds*1e3))}disconnectedCallback(){L(this,W)&&clearInterval(L(this,W)),super.disconnectedCallback()}onSessionChange(){this.refresh()}async refresh(){let e=this.sdkOrNull;if(!e?.isLoggedIn){this.balance=null;return}let r=await this.run(()=>e.credits.balance());r!==void 0&&(this.balance=r)}render(){return this.sdkOrNull?this.sdk.isLoggedIn?o`
      <span class="wrap">
        <span class="label muted">${this.label}</span>
        <span class="value" aria-live="polite"
          >${this.balance===null?"\u2026":this.balance.toLocaleString()}</span
        >
      </span>
      ${this.error?o`<span class="error" role="alert">${this.error}</span>`:l}
    `:o`<span class="muted">Not signed in</span>`:o`<span class="muted">…</span>`}};W=new WeakMap,T.styles=[m.baseStyles,w`
      :host {
        display: inline-block;
      }
      .wrap {
        display: inline-flex;
        align-items: baseline;
        gap: 0.4em;
      }
      .label {
        font: var(--type-eyebrow, 500 12px/1.2 "Geist", system-ui, sans-serif);
        letter-spacing: var(--tracking-caps, 0.08em);
        text-transform: uppercase;
        color: var(--text-faint, var(--fb-faint));
      }
      /* A balance is a quantity, so it is set in mono. Tabular figures also
         stop the number jittering sideways as it ticks over on poll. */
      .value {
        font-family: var(--font-mono, "Geist Mono", ui-monospace, monospace);
        font-variant-numeric: tabular-nums;
        font-weight: var(--weight-medium, 500);
        color: var(--text-strong, var(--fb-strong));
      }
    `],c([v({type:Number,attribute:"poll-seconds"})],T.prototype,"pollSeconds",2),c([v({type:String})],T.prototype,"label",2),c([p()],T.prototype,"balance",2),T=c([C("openapps-credits")],T);var x=class extends m{constructor(){super(...arguments);this.pageSize=25;this.appId="";this.noSummary=!1;this.entries=[];this.cursor=null;this.complete=!1;this.loaded=!1}connectedCallback(){super.connectedCallback(),this.refresh()}onSessionChange(){this.refresh()}async refresh(){this.entries=[],this.cursor=null,this.complete=!1,this.loaded=!1,await this.loadMore()}async loadMore(){let e=this.sdkOrNull;if(!e?.isLoggedIn){this.loaded=!0;return}let r=await this.run(()=>e.credits.history({cursor:this.cursor??void 0,limit:this.pageSize}));this.loaded=!0,r&&(this.entries=[...this.entries,...r.entries],this.cursor=r.next_cursor,this.complete=r.next_cursor===null)}get visible(){return this.appId?this.entries.filter(e=>e.app_id===this.appId):this.entries}get spending(){let e=new Map;for(let r of this.visible){if(r.amount>=0)continue;let n=Oe(r),i=e.get(n);i?(i.credits+=-r.amount,i.count+=1):e.set(n,{label:n,credits:-r.amount,count:1})}return[...e.values()].sort((r,n)=>n.credits-r.credits)}render(){if(!this.sdkOrNull)return o`<p class="muted">Loading…</p>`;if(!this.sdk.isLoggedIn)return o`<p class="muted">Sign in to see where your credits went.</p>`;if(!this.loaded)return o`<p class="muted">Loading…</p>`;let e=this.visible;if(e.length===0)return o`
        <p class="muted">
          Nothing yet. Credits you buy and spend both appear here, with what
          each one was for.
        </p>
        ${this.error?o`<p class="error" role="alert">${this.error}</p>`:l}
      `;let r=this.noSummary?[]:this.spending,n=r.reduce((i,a)=>i+a.credits,0);return o`
      ${r.length?o`
            <div class="summary">
              <div class="eyebrow">
                ${this.complete?"Spent, all time":"Spent, recent activity"}
              </div>
              <ul class="groups">
                ${r.map(i=>o`
                    <li>
                      <span class="what" title=${i.label}>${i.label}</span>
                      <span class="times muted"
                        >${i.count===1?"once":`${i.count}\xD7`}</span
                      >
                      <span class="mono amount">${i.credits.toLocaleString()}</span>
                      <!-- The bar is proportional to the largest row, not to
                           the total: with one dominant item every other bar
                           would round to nothing and the comparison people
                           actually want — this against that — disappears. -->
                      <span
                        class="bar"
                        style=${`--w:${Math.round(i.credits/r[0].credits*100)}%`}
                      ></span>
                    </li>
                  `)}
              </ul>
              <p class="caption">
                ${n.toLocaleString()} credits across ${e.length}
                ${e.length===1?"entry":"entries"}${this.complete?"":" so far"}.
              </p>
            </div>
          `:l}

      <div class="eyebrow rule">Activity</div>
      <ul class="entries">
        ${e.map(i=>o`
            <li>
              <span class="when muted">${jt(i.created_at)}</span>
              <span class="what" title=${ct(i)}
                >${ct(i)}</span
              >
              <span class="mono amount ${i.amount<0?"debit":"credit"}">
                ${i.amount>0?"+":"\u2212"}${Math.abs(i.amount).toLocaleString()}
              </span>
              <span class="mono after muted" title="Balance after"
                >${i.balance_after.toLocaleString()}</span
              >
            </li>
          `)}
      </ul>

      ${this.cursor!==null?o`<button
            class="block"
            ?disabled=${this.busy}
            @click=${()=>{this.loadMore()}}
          >
            ${this.busy?"Loading\u2026":"Show earlier"}
          </button>`:l}
      ${this.error?o`<p class="error" role="alert">${this.error}</p>`:l}
    `}};x.styles=[m.baseStyles,w`
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .summary {
        display: grid;
        gap: 8px;
        margin-bottom: 18px;
      }
      /* Label, count, amount — then the bar spanning the full width beneath,
         so a long feature name never squeezes the figure it belongs to. */
      .groups li {
        display: grid;
        grid-template-columns: 1fr auto auto;
        align-items: baseline;
        gap: 8px;
        padding: 5px 0;
      }
      .groups .bar {
        grid-column: 1 / -1;
        height: 3px;
        border-radius: var(--radius-full, 999px);
        background: var(--brand-soft, #e6f9f3);
        width: var(--w, 0%);
        min-width: 2px;
      }
      .times {
        font: var(--type-caption, 400 12px/1.35 "Geist", system-ui, sans-serif);
      }
      .rule {
        display: block;
        padding-top: 12px;
        border-top: var(--border-width, 1px) solid
          var(--border-hairline, var(--fb-hairline));
      }
      .entries li {
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        align-items: baseline;
        gap: 10px;
        padding: 7px 0;
        border-bottom: var(--border-width, 1px) solid
          var(--border-hairline, var(--fb-hairline));
      }
      .entries li:last-child {
        border-bottom: none;
      }
      .when {
        font: var(--type-caption, 400 12px/1.35 "Geist", system-ui, sans-serif);
        white-space: nowrap;
      }
      /* A feature name is arbitrary text from whichever app charged; it
         truncates rather than pushing the amount off the panel. */
      .what {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--text-strong, var(--fb-strong));
        font: var(--type-ui, 500 13px/1.3 "Geist", system-ui, sans-serif);
      }
      .amount {
        font-weight: var(--weight-medium, 500);
        color: var(--text-strong, var(--fb-strong));
      }
      /* Spending is the ordinary case here, so it stays in the body colour;
         only money arriving is worth a tone. Colouring every debit red would
         make a working account look like a page of errors. */
      .amount.credit {
        color: var(--success-fg, #0b8a68);
      }
      .after {
        font: var(--type-caption, 400 12px/1.35 "Geist", system-ui, sans-serif);
        min-width: 3.5em;
        text-align: right;
      }
      button.block {
        margin-top: 12px;
      }
    `],c([v({type:Number,attribute:"page-size"})],x.prototype,"pageSize",2),c([v({type:String,attribute:"app-id"})],x.prototype,"appId",2),c([v({type:Boolean,attribute:"no-summary"})],x.prototype,"noSummary",2),c([p()],x.prototype,"entries",2),c([p()],x.prototype,"cursor",2),c([p()],x.prototype,"complete",2),c([p()],x.prototype,"loaded",2),x=c([C("openapps-history")],x);function Oe(s){let t=s.app_name??s.app_id??null,e=s.ref_id??null;return t&&e?`${t} \xB7 ${e}`:t||e||"Spent"}function ct(s){switch(s.kind){case"debit":return Oe(s);case"topup":return"Credits purchased";case"referral_bonus":return"Referral bonus";case"adjustment":return s.ref_id?`Adjustment \u2014 ${s.ref_id}`:"Adjustment";case"refund":return s.amount<0?"Payment reversed":"Refund";default:return Oe(s)}}function jt(s){let t=new Date(s*1e3);return Number.isNaN(t.getTime())?"":t.toLocaleDateString(void 0,{month:"short",day:"numeric"})}function dt(s){return new Date(s*1e3).toLocaleDateString(void 0,{day:"numeric",month:"short"})}var E=class extends m{constructor(){super(...arguments);this.info=null;this.earnings=null;this.referees=null;this.tab="link";this.copied=!1}connectedCallback(){super.connectedCallback(),this.load()}onSessionChange(){this.load()}async load(){let e=this.sdkOrNull;if(!e?.isLoggedIn){this.info=null,this.earnings=null,this.referees=null;return}this.info=await this.run(()=>e.referral.code())??null,this.earnings=await this.run(()=>e.referral.earnings())??null,this.referees=await this.run(()=>e.referral.referees())??null}get link(){let e=this.inviteUrl??(typeof location>"u"?"":`${location.origin}${location.pathname}`);if(!this.info)return e;let r=e.includes("?")?"&":"?";return`${e}${r}ref=${encodeURIComponent(this.info.code)}`}async copy(){try{await navigator.clipboard.writeText(this.link),this.copied=!0,setTimeout(()=>this.copied=!1,2e3)}catch{this.error="Could not copy. Select the link and copy it manually."}}render(){if(!this.sdkOrNull)return o`<p class="muted">Loading…</p>`;if(!this.sdk.isLoggedIn)return o`<p class="muted">Sign in to get your invite link.</p>`;if(!this.info)return o`<p class="muted">${this.error??"Loading\u2026"}</p>`;let e=this.referees?.referees??[],r=this.earnings?.entries??[],n=[["link","Your link"],["referees",`Referees${e.length?` (${e.length})`:""}`],["earnings",`Earnings${r.length?` (${r.length})`:""}`]];return o`
      <div class="stack">
        <div class="tabs" role="tablist">
          ${n.map(([i,a])=>o`
              <button
                role="tab"
                aria-selected=${this.tab===i}
                class="tab ${this.tab===i?"on":""}"
                @click=${()=>this.tab=i}
              >
                ${a}
              </button>
            `)}
        </div>
        ${this.tab==="link"?this.renderLink():this.tab==="referees"?this.renderReferees(e):this.renderEarnings(r)}
        ${this.error?o`<p class="error" role="alert">${this.error}</p>`:l}
      </div>
    `}renderLink(){let e=this.earnings?.total??0,r=this.earnings?.entries.length??0;return o`
      <p class="desc">
        Share this link. When someone signs up through it and buys credits,
        you earn <strong>${this.info?.bonus_percent}%</strong> of what they
        buy, as credits.
      </p>
      <code class="payload">${this.link}</code>
      <div class="row">
        <button @click=${this.copy}>${this.copied?"Copied":"Copy link"}</button>
        <span class="muted mono">${this.info?.code}</span>
      </div>
      <div class="earned">
        <span class="eyebrow">Earned</span>
        <span class="total mono">${e.toLocaleString()}</span>
        <span class="caption">
          ${r===0?"No referred purchases yet.":`credits from ${r} purchase${r===1?"":"s"}`}
        </span>
      </div>
    `}renderReferees(e){return e.length===0?o`<p class="muted">
        Nobody has signed up through your link yet.
      </p>`:o`
      <p class="caption">
        Handles only — signing up through a link does not share someone's
        identity with you.
      </p>
      <div class="list">
        ${e.map(r=>o`
            <div class="item">
              <span class="mono handle">${r.handle}</span>
              <span class="grow caption">
                joined ${dt(r.joined_at)} ·
                ${r.purchases===0?"no purchases yet":`${r.purchases} purchase${r.purchases===1?"":"s"}`}
              </span>
              <span class="mono amount ${r.earned>0?"good":""}">
                ${r.earned>0?`+${r.earned.toLocaleString()}`:"\u2014"}
              </span>
            </div>
          `)}
      </div>
    `}renderEarnings(e){return e.length===0?o`<p class="muted">
        No referral earnings yet. A bonus is credited when a referee's
        purchase settles.
      </p>`:o`
      <p class="caption">
        Each row is one bonus, credited in the same transaction as the
        referee's purchase — so this list and your balance cannot disagree.
      </p>
      <div class="list">
        ${e.map(r=>o`
            <div class="item">
              <span class="mono date">${dt(r.created_at)}</span>
              <span class="grow caption">
                ${r.referee??"unknown"}
                ${r.referee_credits?o` bought ${r.referee_credits.toLocaleString()} credits`:l}
              </span>
              <span class="mono amount good">+${r.amount.toLocaleString()}</span>
            </div>
          `)}
      </div>
    `}};E.styles=[m.baseStyles,w`
      .stack {
        display: grid;
        gap: 12px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .tabs {
        display: flex;
        gap: 4px;
        border-bottom: var(--border-width, 1px) solid
          var(--border-hairline, var(--fb-hairline));
      }
      /* Underline tabs sitting on the hairline, with a 2px near-black
         indicator — not a filled pill, and never a coloured bar. The
         indicator is drawn on the tab itself and pulled down over the rule
         so the selected tab reads as continuous with its panel. */
      .tab {
        border: none;
        border-bottom: 2px solid transparent;
        border-radius: 0;
        background: transparent;
        color: var(--text-muted, var(--fb-muted));
        margin-bottom: -1px;
        padding: 0 10px;
      }
      .tab.on {
        border-bottom-color: var(--text-strong, var(--fb-strong));
        color: var(--text-strong, var(--fb-strong));
      }
      .tab:hover:not(.on) {
        color: var(--text-strong, var(--fb-strong));
        background: transparent;
      }
      .list {
        display: grid;
        border: var(--border-width, 1px) solid
          var(--border-hairline, var(--fb-hairline));
        border-radius: var(--radius-lg, 12px);
        overflow: hidden;
      }
      .item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
      }
      .item + .item {
        border-top: var(--border-width, 1px) solid
          var(--border-hairline, var(--fb-hairline));
      }
      .grow {
        flex: 1;
      }
      .date,
      .handle {
        font-size: var(--text-2xs, 11px);
        color: var(--text-faint, var(--fb-faint));
        min-width: 3.4em;
      }
      .amount {
        font-size: var(--text-sm, 13px);
        font-weight: var(--weight-medium, 500);
        color: var(--text-muted, var(--fb-muted));
      }
      .amount.good {
        color: var(--success-fg, #0b8a68);
      }
      .earned {
        display: grid;
        gap: 4px;
        padding: 14px 16px;
        border: var(--border-width, 1px) solid
          var(--border-hairline, var(--fb-hairline));
        border-radius: var(--radius-lg, 12px);
        background: var(--surface-card, var(--fb-card));
      }
      /* A balance is a quantity, so it is mono — same rule as the credit
         badge and the ledger. */
      .total {
        font-size: var(--text-3xl, 40px);
        font-weight: var(--weight-medium, 500);
        line-height: 1;
        letter-spacing: var(--tracking-display, -0.035em);
        color: var(--text-strong, var(--fb-strong));
      }
    `],c([v({type:String,attribute:"invite-url"})],E.prototype,"inviteUrl",2),c([p()],E.prototype,"info",2),c([p()],E.prototype,"earnings",2),c([p()],E.prototype,"referees",2),c([p()],E.prototype,"tab",2),c([p()],E.prototype,"copied",2),E=c([C("openapps-referral")],E);var q,_=class extends m{constructor(){super(...arguments);this.rails="";this.returnTo="";this.packages=null;this.selected=null;this.instruction=null;this.topup=null;this.waiting=!1;ne(this,q)}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){L(this,q)?.abort(),super.disconnectedCallback()}onSessionChange(){if(!this.packages){this.load();return}this.requestUpdate()}async load(){if(!this.sdkOrNull)return;let e=await this.run(()=>this.sdk.payments.packages());e&&(this.packages=e)}get offeredRails(){if(!this.packages)return[];let e=["stripe","ethereum","lightning"].filter(n=>this.packages?.rails?.[n]),r=this.rails.split(",").map(n=>n.trim()).filter(Boolean);return r.length?e.filter(n=>r.includes(n)):e}async start(e){let r=this.selected;r&&await this.run(async()=>{let n;switch(e){case"stripe":{let i=await this.sdk.payments.stripeCheckout(r.id,{returnTo:this.returnTo==="none"?null:this.returnTo||void 0});this.instruction={kind:"redirect"},!this.dispatchEvent(new CustomEvent("openapps-checkout",{detail:{url:i.checkout_url,packageId:r.id},cancelable:!0,bubbles:!0,composed:!0}))||(window.location.href=i.checkout_url);return}case"ethereum":{let i=await this.sdk.payments.ethDepositAddress(r.id);n=i.topup_id,this.instruction={kind:"address",chain:i.chain,address:i.address,amount:i.expected_amount};break}case"lightning":{let i=await this.sdk.payments.lightningInvoice(r.id);n=i.topup_id,this.instruction={kind:"invoice",bolt11:i.bolt11,amountMsat:i.amount_msat};break}}this.watch(n,Wt[e])})}async watch(e,r){L(this,q)?.abort();let n=new AbortController;ie(this,q,n),this.waiting=!0;try{let i=await this.sdk.payments.waitFor(e,{timeoutMs:r,signal:n.signal,onPoll:a=>{this.topup=a}});this.topup=i,i.status==="confirmed"&&(this.emit("openapps-topup",i),k())}catch(i){i instanceof Error&&i.name==="AbortError"||(this.error=Jt(i))}finally{this.waiting=!1}}reset(){L(this,q)?.abort(),this.selected=null,this.instruction=null,this.topup=null,this.error=null}render(){return this.sdkOrNull?this.sdk.isLoggedIn?this.packages?this.instruction?this.renderInstruction(this.instruction):this.selected?this.renderRails(this.selected):this.renderPackages(this.packages.packages??[]):o`<p class="muted">${this.error??"Loading packages\u2026"}</p>`:o`<p class="muted">Sign in to buy credits.</p>`:o`<p class="muted">Loading…</p>`}renderPackages(e){return e.length===0?o`<p class="muted">No credit packages are configured.</p>`:o`
      <div class="grid">
        ${e.map(r=>o`
            <button class="package" @click=${()=>this.selected=r}>
              <span class="credits">
                ${r.credits.toLocaleString()} credits
              </span>
              <span class="perunit caption">${Vt(r)}</span>
              <span class="price">${ht(r.usd_price)}</span>
            </button>
          `)}
      </div>
      ${this.error?o`<p class="error" role="alert">${this.error}</p>`:l}
    `}renderRails(e){let r=this.offeredRails;return o`
      <p>
        <strong>${e.credits.toLocaleString()} credits</strong> —
        ${ht(e.usd_price)}
      </p>
      <div class="stack">
        ${r.map(n=>o`
            <button class="primary" ?disabled=${this.busy} @click=${()=>this.start(n)}>
              ${Ft[n]}
            </button>
          `)}
        ${r.length===0?o`<p class="muted">No payment methods are enabled.</p>`:l}
        <button @click=${this.reset}>Back</button>
      </div>
      ${this.error?o`<p class="error" role="alert">${this.error}</p>`:l}
    `}renderInstruction(e){let r=this.topup?.status??"pending";return r==="confirmed"?o`
        <span class="badge success"><span class="dot"></span>Confirmed</span>
        <p class="ok">Payment confirmed — credits added.</p>
        <button @click=${this.reset}>Buy more</button>
      `:r==="failed"||r==="expired"?o`
        <span class="badge danger"><span class="dot"></span>${r==="failed"?"Failed":"Expired"}</span>
        <p class="error" role="alert">This top-up ${r}. Nothing was charged.</p>
        <button @click=${this.reset}>Try again</button>
      `:o`
      ${e.kind==="redirect"?o`<p class="muted">Redirecting to checkout…</p>`:l}
      ${e.kind==="address"?o`
            <p>Send exactly <strong>${Kt(e.amount,6)}</strong> USDC or
            USDT on <code>${e.chain}</code> to:</p>
            <code class="payload">${e.address}</code>
          `:l}
      ${e.kind==="invoice"?o`
            <p>Pay this Lightning invoice
            (<strong>${Math.ceil(e.amountMsat/1e3).toLocaleString()} sats</strong>):</p>
            <code class="payload">${e.bolt11}</code>
          `:l}
      ${e.kind!=="redirect"?o`
            <div class="row">
              <button @click=${()=>this.copy(Bt(e))}>Copy</button>
              <button @click=${this.reset}>Cancel</button>
            </div>
            ${this.renderWaiting()}
          `:l}
      ${this.error?o`<p class="error" role="alert">${this.error}</p>`:l}
    `}renderWaiting(){if(!this.waiting)return o`<p class="muted" aria-live="polite">Not watching for payment.</p>`;let e=this.topup?.confirmations;if(e===void 0)return o`<p class="muted" aria-live="polite">Waiting for payment…</p>`;let r=this.topup?.confirmations_required;if(r==null)return o`
        <p class="muted" aria-live="polite">
          Payment received — waiting for the network to finalise it.
        </p>
      `;let n=Math.min(e,r);return o`
      <p class="muted" aria-live="polite">
        Payment received — confirming (${n} of ${r}).
      </p>
      <progress
        class="confirms"
        max=${r}
        value=${n}
        aria-label="Confirmations"
      ></progress>
    `}async copy(e){try{await navigator.clipboard.writeText(e)}catch{this.error="Could not copy \u2014 select the text and copy it manually."}}};q=new WeakMap,_.styles=[m.baseStyles,w`
      /* Packs stack as rows rather than tiles: the numbers line up down the
         right edge, which is what makes three prices comparable at a glance. */
      .grid {
        display: grid;
        gap: 8px;
      }
      .package {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: auto;
        padding: 14px 16px;
        text-align: left;
        border-radius: var(--radius-lg, 12px);
      }
      .package:hover:not([disabled]) {
        border-color: var(--border-strong, var(--fb-hairline));
      }
      .credits {
        flex: 1;
        font: var(--weight-medium, 500) var(--text-base, 15px) / 1.2
          var(--font-sans, "Geist", system-ui, sans-serif);
        color: var(--text-strong, var(--fb-strong));
      }
      /* Money is always mono — balances, prices, per-unit rates, ledger
         amounts. Tabular figures keep the column aligned across packs. */
      .price {
        font-family: var(--font-mono, "Geist Mono", ui-monospace, monospace);
        font-variant-numeric: tabular-nums;
        font-size: var(--text-md, 17px);
        color: var(--text-strong, var(--fb-strong));
      }
      .perunit {
        font-family: var(--font-mono, "Geist Mono", ui-monospace, monospace);
        font-size: var(--text-2xs, 11px);
        color: var(--text-faint, var(--fb-faint));
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
      }
      .row {
        display: flex;
        gap: 0.5em;
        margin-top: 0.5em;
      }
      .ok {
        font-weight: 600;
      }
      .confirms {
        display: block;
        width: 100%;
        height: 0.4em;
        margin-top: 0.35em;
        border: none;
        border-radius: 999px;
        overflow: hidden;
        background: var(--surface-card, var(--fb-card));
        accent-color: var(--brand, var(--fb-brand));
      }
      /* WebKit ignores accent-color on <progress>, so colour it directly. */
      .confirms::-webkit-progress-bar {
        background: var(--surface-card, var(--fb-card));
      }
      .confirms::-webkit-progress-value {
        background: var(--brand, var(--fb-brand));
      }
    `],c([v({type:String})],_.prototype,"rails",2),c([v({type:String,attribute:"return-to"})],_.prototype,"returnTo",2),c([p()],_.prototype,"packages",2),c([p()],_.prototype,"selected",2),c([p()],_.prototype,"instruction",2),c([p()],_.prototype,"topup",2),c([p()],_.prototype,"waiting",2),_=c([C("openapps-buy")],_);var Ft={stripe:"Pay by card",ethereum:"Pay with USDC / USDT",lightning:"Pay with Lightning"},Wt={stripe:void 0,lightning:void 0,ethereum:1800*1e3};function Bt(s){return s.kind==="address"?s.address:s.kind==="invoice"?s.bolt11:""}function ht(s){return`$${(s/100).toFixed(2)}`}function Vt(s){if(s.credits<=0)return"";let t=s.usd_price/s.credits;return`${t<1?t.toFixed(2):t.toFixed(1)}\xA2 each`}function Kt(s,t){let e=10**t;return(s/e).toFixed(t).replace(/\.?0+$/,"")}function Jt(s){let t=s instanceof Error?s.message:String(s);return t.includes("still pending")?"Still waiting on the network. Your credits will appear once the payment settles.":t}export{P as OpenAppsAccount,_ as OpenAppsBuy,T as OpenAppsCredits,m as OpenAppsElement,x as OpenAppsHistory,$ as OpenAppsLogin,E as OpenAppsReferral,b as WalletError,zt as availableNamespaces,De as configure,G as connectEthereum,Ae as findNostrProvider,vt as getClient,k as notify,ge as onChange,F as signNostr,Me as signNostrWithBunker,Re as signNostrWithSecretKey,j as signSiwe,pe as waitForNostrProvider};
//# sourceMappingURL=openapps-ui.js.map
