import{a as u,b as M,c as se,d as ne}from"./chunk-LCQWCHVU.js";var v=class extends Error{code;status;balance;detail;constructor(e,t,r=0,n,i){super(t),this.name="OpenAppsError",this.code=e,this.status=r,this.balance=n,this.detail=i}get isAuthError(){return this.code==="unauthorized"}},ct={400:"bad_request",401:"unauthorized",402:"insufficient_balance",404:"not_found",409:"conflict",429:"rate_limited"};function Le(s,e){let t=e&&typeof e=="object"?e.error:void 0,r=t&&typeof t=="object"?t:void 0,n=r?.code??ct[s]??"internal",i=r?.message??`request failed with status ${s}`,a;if(n==="insufficient_balance"){let c=/-?\d+/.exec(i);c&&(a=Number(c[0]))}return new v(n,i,s,a,r)}function pe(s=null){let e=s;return{get:()=>e,set:t=>{e=t}}}function dt(s="openapps.session"){let e=null;try{e=typeof localStorage<"u"?localStorage:null,e?.setItem(s,e.getItem(s)??""),e?.getItem(s)===""&&e.removeItem(s)}catch{e=null}if(!e)return pe();let t=e;return{get(){let r=t.getItem(s);if(!r)return null;try{let n=JSON.parse(r);return n.accessToken&&n.refreshToken?n:null}catch{return null}},set(r){r?t.setItem(s,JSON.stringify(r)):t.removeItem(s)}}}function Oe(){try{return typeof localStorage<"u"?dt():pe()}catch{return pe()}}var ht=new Set(["confirmed","failed","expired"]),W=class{baseUrl;#r;#s;#o;#l;#n=null;#i=null;constructor(e){this.baseUrl=e.baseUrl.replace(/\/+$/,""),this.#r=e.appKey,this.#s=e.store??Oe();let t=e.fetch??globalThis.fetch;if(!t)throw new v("network","no fetch implementation available; pass one via options.fetch");this.#o=(r,n)=>t(r,n),this.#l=e.onAuthChange}get session(){return this.#s.get()}get isLoggedIn(){return this.#s.get()!==null}#t(e){this.#s.set(e),this.#l?.(e)}adoptSession(e,t){this.#t({accessToken:e,refreshToken:t})}clearSession(){this.#t(null)}async#e(e,t={}){let r=t.auth??"none";if(r!=="none"&&!this.#s.get())throw new v("unauthorized","not logged in");if(r==="app+bearer"&&!this.#r)throw new v("unauthorized","this call needs an app key; construct OpenApps with { appKey }");return this.#a(e,t,r,!0)}async#a(e,t,r,n){let i=`${this.baseUrl}${e}`;if(t.query){let h=new URLSearchParams;for(let[f,x]of Object.entries(t.query))x!==void 0&&h.set(f,String(x));let m=h.toString();m&&(i+=`?${m}`)}let a={accept:"application/json"};t.body!==void 0&&(a["content-type"]="application/json"),r!=="none"&&(a.authorization=`Bearer ${this.#s.get()?.accessToken??""}`),r==="app+bearer"&&this.#r&&(a["x-openapps-app-key"]=this.#r);let c;try{c=await this.#o(i,{method:t.method??"GET",headers:a,body:t.body===void 0?void 0:JSON.stringify(t.body),signal:t.signal})}catch(h){throw h instanceof Error&&h.name==="AbortError"?h:new v("network",h instanceof Error?h.message:"network request failed")}if(c.status===401&&r!=="none"&&n&&await this.#d())return this.#a(e,t,r,!1);let l=await this.#c(c);if(!c.ok){let h=Le(c.status,l);throw h.code==="unauthorized"&&r!=="none"&&this.#t(null),h}return l}async#c(e){if(e.status===204)return null;let t=await e.text();if(!t)return null;try{return JSON.parse(t)}catch{throw new v(e.ok?"internal":"network",`expected JSON, got: ${t.slice(0,200)}`,e.status)}}#d(){if(this.#n)return this.#n;let e=this.#s.get();return e?(this.#n=(async()=>{try{let t=await this.#a("/v1/auth/refresh",{method:"POST",body:{refresh_token:e.refreshToken}},"none",!1),r={accessToken:t.access_token,refreshToken:t.refresh_token};return this.#t(r),r}catch{return this.#t(null),null}finally{this.#n=null}})(),this.#n):Promise.resolve(null)}auth={methods:async e=>(await this.#e("/v1/auth/methods",{signal:e})).methods,challenge:(e,t,r)=>this.#e("/v1/auth/challenge",{method:"POST",body:{namespace:e,address:t},signal:r}),verify:async(e,t,r={})=>{let n=await this.#e("/v1/auth/verify",{method:"POST",body:{challenge_id:e,proof:t,referral_code:r.referralCode},signal:r.signal});return this.#t({accessToken:n.access_token,refreshToken:n.refresh_token}),n},googleStartUrl:(e,t)=>{let r=new URLSearchParams;e&&r.set("return_to",e),t&&r.set("ref",t);let n=r.toString();return`${this.baseUrl}/v1/auth/oidc/google/start${n?`?${n}`:""}`},completeRedirect:(e={})=>{let t=pt(e,"code");return t?this.#i?this.#i:(this.#i=(async()=>{try{let r=await this.#e("/v1/auth/oidc/exchange",{method:"POST",body:{code:t},signal:e.signal});return this.#t({accessToken:r.access_token,refreshToken:r.refresh_token}),e.hash===void 0&&e.url===void 0&&typeof history<"u"&&typeof location<"u"&&history.replaceState({},"",location.pathname+location.search),r}finally{this.#i=null}})(),this.#i):Promise.resolve(null)},me:e=>this.#e("/v1/me",{auth:"bearer",signal:e}),logout:async e=>{try{await this.#e("/v1/auth/logout",{method:"POST",auth:"bearer",signal:e})}finally{this.#t(null)}},linkChallenge:(e,t,r)=>this.#e("/v1/auth/link/challenge",{method:"POST",auth:"bearer",body:{namespace:e,address:t},signal:r}),linkVerify:(e,t,r={})=>this.#e("/v1/auth/link/verify",{method:"POST",auth:"bearer",body:{challenge_id:e,proof:t,merge:r.merge??!1},signal:r.signal}),googleLinkStart:async(e,t={})=>(await this.#e("/v1/auth/link/oidc/google/start",{method:"POST",auth:"bearer",body:{return_to:e,merge:t.merge??!1},signal:t.signal})).auth_url,completeLinkRedirect:(e={})=>{let t=Ie(e),r=t.get("linked"),n=t.get("link_conflict"),i=t.get("link_blocked"),a=t.get("link_error");if(!r&&!n&&!i&&!a)return null;if(e.hash===void 0&&e.url===void 0&&typeof history<"u"&&history.replaceState({},"",location.pathname+location.search),a)return{status:"error",message:a};if(i){let c=(t.get("clashes")??"").split(",").filter(Boolean),l=c.map(h=>({google:"Google",eip155:"wallet",nostr:"Nostr"})[h]??h).join(" and ");return{status:"blocked",namespaces:c,message:`That Google account belongs to another account which also has a ${l} sign-in, and so does this one. Disconnect it from the other account first.`}}return n?{status:"conflict",namespace:n,balance:Number(t.get("balance")??0)}:{status:"linked",namespace:r,merged:t.get("merged")==="1",credits:Number(t.get("credits")??0)}},unlink:(e,t)=>this.#e(`/v1/auth/link/${encodeURIComponent(e)}`,{method:"DELETE",auth:"bearer",signal:t})};credits={balance:async e=>(await this.#e("/v1/credits/balance",{auth:"bearer",signal:e})).balance,deduct:(e,t,r,n)=>this.#e("/v1/credits/deduct",{method:"POST",auth:"app+bearer",body:{amount:e,reason:t,idempotency_key:r},signal:n}),history:(e={})=>this.#e("/v1/credits/history",{auth:"bearer",query:{cursor:e.cursor,limit:e.limit},signal:e.signal})};payments={packages:e=>this.#e("/v1/payments/packages",{signal:e}),stripeCheckout:(e,t={})=>this.#e("/v1/payments/stripe/checkout",{method:"POST",auth:"bearer",body:{package_id:e,return_to:t.returnTo===null?void 0:t.returnTo??ut()},signal:t.signal}),ethDepositAddress:(e,t)=>this.#e("/v1/payments/eth/deposit-address",{method:"POST",auth:"bearer",body:{package_id:e},signal:t}),lightningInvoice:(e,t)=>this.#e("/v1/payments/lightning/invoice",{method:"POST",auth:"bearer",body:{package_id:e},signal:t}),list:e=>this.#e("/v1/payments/topups",{auth:"bearer",signal:e}),get:(e,t)=>this.#e(`/v1/payments/topups/${encodeURIComponent(e)}`,{auth:"bearer",signal:t}),waitFor:async(e,t={})=>{let r=t.intervalMs??2e3,n=Date.now()+(t.timeoutMs??900*1e3);for(;;){t.signal?.throwIfAborted();try{let i=await this.payments.get(e,t.signal);if(t.onPoll?.(i),ht.has(i.status))return i}catch(i){if(i instanceof v&&i.code!=="network"||!(i instanceof v))throw i}if(Date.now()+r>n)throw new v("timeout",`top-up ${e} was still pending after the timeout`);await ft(r,t.signal)}}};referral={code:e=>this.#e("/v1/referral/code",{auth:"bearer",signal:e}),apply:(e,t)=>this.#e("/v1/referral/apply",{method:"POST",auth:"bearer",body:{code:e},signal:t}),earnings:e=>this.#e("/v1/referral/earnings",{auth:"bearer",signal:e}),referees:e=>this.#e("/v1/referral/referees",{auth:"bearer",signal:e})}};function ut(){if(!(typeof location>"u"))return`${location.origin}${location.pathname}${location.search}`}function Ie(s){if(s.url!==void 0){let t=s.url,r=t.indexOf("#"),n=t.indexOf("?"),i=r>=0?t.slice(r+1):"",c=n>=0&&(r<0||n<r)?t.slice(n+1,r>=0?r:void 0):"",l=new URLSearchParams(i),h=new URLSearchParams(c);return{get:m=>l.get(m)??h.get(m)}}let e=s.hash??(typeof location>"u"?"":location.hash);return new URLSearchParams(e.replace(/^#/,""))}function pt(s,e){return Ie(s).get(e)}function ft(s,e){return new Promise((t,r)=>{let n=setTimeout(()=>{e?.removeEventListener("abort",i),t()},s),i=()=>{clearTimeout(n),r(e?.reason??new Error("aborted"))};e?.addEventListener("abort",i,{once:!0})})}var B=null;function He(s){return B=new W(s),w(),B}function mt(){return B}function ze(s,e){if(s)return s;if(B)return B;if(e)return He({baseUrl:e});throw new Error("no OpenApps client: call configure({ baseUrl }) or set base-url on the element")}var fe=new Set;function me(s){return fe.add(s),()=>fe.delete(s)}function w(){for(let s of fe)s()}var ie=globalThis,ae=ie.ShadowRoot&&(ie.ShadyCSS===void 0||ie.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,ge=Symbol(),qe=new WeakMap,V=class{constructor(e,t,r){if(this._$cssResult$=!0,r!==ge)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(ae&&e===void 0){let r=t!==void 0&&t.length===1;r&&(e=qe.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),r&&qe.set(t,e))}return e}toString(){return this.cssText}},De=s=>new V(typeof s=="string"?s:s+"",void 0,ge),k=(s,...e)=>{let t=s.length===1?s[0]:e.reduce((r,n,i)=>r+(a=>{if(a._$cssResult$===!0)return a.cssText;if(typeof a=="number")return a;throw Error("Value passed to 'css' function must be a 'css' function result: "+a+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(n)+s[i+1],s[0]);return new V(t,s,ge)},je=(s,e)=>{if(ae)s.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(let t of e){let r=document.createElement("style"),n=ie.litNonce;n!==void 0&&r.setAttribute("nonce",n),r.textContent=t.cssText,s.appendChild(r)}},be=ae?s=>s:s=>s instanceof CSSStyleSheet?(e=>{let t="";for(let r of e.cssRules)t+=r.cssText;return De(t)})(s):s;var{is:gt,defineProperty:bt,getOwnPropertyDescriptor:vt,getOwnPropertyNames:yt,getOwnPropertySymbols:wt,getPrototypeOf:kt}=Object,oe=globalThis,Fe=oe.trustedTypes,$t=Fe?Fe.emptyScript:"",xt=oe.reactiveElementPolyfillSupport,K=(s,e)=>s,J={toAttribute(s,e){switch(e){case Boolean:s=s?$t:null;break;case Object:case Array:s=s==null?s:JSON.stringify(s)}return s},fromAttribute(s,e){let t=s;switch(e){case Boolean:t=s!==null;break;case Number:t=s===null?null:Number(s);break;case Object:case Array:try{t=JSON.parse(s)}catch{t=null}}return t}},le=(s,e)=>!gt(s,e),Ge={attribute:!0,type:String,converter:J,reflect:!1,useDefault:!1,hasChanged:le};Symbol.metadata??=Symbol("metadata"),oe.litPropertyMetadata??=new WeakMap;var A=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=Ge){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let r=Symbol(),n=this.getPropertyDescriptor(e,r,t);n!==void 0&&bt(this.prototype,e,n)}}static getPropertyDescriptor(e,t,r){let{get:n,set:i}=vt(this.prototype,e)??{get(){return this[t]},set(a){this[t]=a}};return{get:n,set(a){let c=n?.call(this);i?.call(this,a),this.requestUpdate(e,c,r)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??Ge}static _$Ei(){if(this.hasOwnProperty(K("elementProperties")))return;let e=kt(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(K("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(K("properties"))){let t=this.properties,r=[...yt(t),...wt(t)];for(let n of r)this.createProperty(n,t[n])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[r,n]of t)this.elementProperties.set(r,n)}this._$Eh=new Map;for(let[t,r]of this.elementProperties){let n=this._$Eu(t,r);n!==void 0&&this._$Eh.set(n,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let r=new Set(e.flat(1/0).reverse());for(let n of r)t.unshift(be(n))}else e!==void 0&&t.push(be(e));return t}static _$Eu(e,t){let r=t.attribute;return r===!1?void 0:typeof r=="string"?r:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let r of t.keys())this.hasOwnProperty(r)&&(e.set(r,this[r]),delete this[r]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return je(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,r){this._$AK(e,r)}_$ET(e,t){let r=this.constructor.elementProperties.get(e),n=this.constructor._$Eu(e,r);if(n!==void 0&&r.reflect===!0){let i=(r.converter?.toAttribute!==void 0?r.converter:J).toAttribute(t,r.type);this._$Em=e,i==null?this.removeAttribute(n):this.setAttribute(n,i),this._$Em=null}}_$AK(e,t){let r=this.constructor,n=r._$Eh.get(e);if(n!==void 0&&this._$Em!==n){let i=r.getPropertyOptions(n),a=typeof i.converter=="function"?{fromAttribute:i.converter}:i.converter?.fromAttribute!==void 0?i.converter:J;this._$Em=n;let c=a.fromAttribute(t,i.type);this[n]=c??this._$Ej?.get(n)??c,this._$Em=null}}requestUpdate(e,t,r,n=!1,i){if(e!==void 0){let a=this.constructor;if(n===!1&&(i=this[e]),r??=a.getPropertyOptions(e),!((r.hasChanged??le)(i,t)||r.useDefault&&r.reflect&&i===this._$Ej?.get(e)&&!this.hasAttribute(a._$Eu(e,r))))return;this.C(e,t,r)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:r,reflect:n,wrapped:i},a){r&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,a??t??this[e]),i!==!0||a!==void 0)||(this._$AL.has(e)||(this.hasUpdated||r||(t=void 0),this._$AL.set(e,t)),n===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[n,i]of this._$Ep)this[n]=i;this._$Ep=void 0}let r=this.constructor.elementProperties;if(r.size>0)for(let[n,i]of r){let{wrapped:a}=i,c=this[n];a!==!0||this._$AL.has(n)||c===void 0||this.C(n,void 0,i,c)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(r=>r.hostUpdate?.()),this.update(t)):this._$EM()}catch(r){throw e=!1,this._$EM(),r}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};A.elementStyles=[],A.shadowRootOptions={mode:"open"},A[K("elementProperties")]=new Map,A[K("finalized")]=new Map,xt?.({ReactiveElement:A}),(oe.reactiveElementVersions??=[]).push("2.1.2");var _e=globalThis,We=s=>s,ce=_e.trustedTypes,Be=ce?ce.createPolicy("lit-html",{createHTML:s=>s}):void 0,Ze="$lit$",N=`lit$${Math.random().toFixed(9).slice(2)}$`,Xe="?"+N,_t=`<${Xe}>`,O=document,Q=()=>O.createComment(""),Z=s=>s===null||typeof s!="object"&&typeof s!="function",Se=Array.isArray,St=s=>Se(s)||typeof s?.[Symbol.iterator]=="function",ve=`[ 	
\f\r]`,Y=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Ve=/-->/g,Ke=/>/g,U=RegExp(`>|${ve}(?:([^\\s"'>=/]+)(${ve}*=${ve}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Je=/'/g,Ye=/"/g,et=/^(?:script|style|textarea|title)$/i,Ce=s=>(e,...t)=>({_$litType$:s,strings:e,values:t}),o=Ce(1),de=Ce(2),ar=Ce(3),I=Symbol.for("lit-noChange"),d=Symbol.for("lit-nothing"),Qe=new WeakMap,L=O.createTreeWalker(O,129);function tt(s,e){if(!Se(s)||!s.hasOwnProperty("raw"))throw Error("invalid template strings array");return Be!==void 0?Be.createHTML(e):e}var Ct=(s,e)=>{let t=s.length-1,r=[],n,i=e===2?"<svg>":e===3?"<math>":"",a=Y;for(let c=0;c<t;c++){let l=s[c],h,m,f=-1,x=0;for(;x<l.length&&(a.lastIndex=x,m=a.exec(l),m!==null);)x=a.lastIndex,a===Y?m[1]==="!--"?a=Ve:m[1]!==void 0?a=Ke:m[2]!==void 0?(et.test(m[2])&&(n=RegExp("</"+m[2],"g")),a=U):m[3]!==void 0&&(a=U):a===U?m[0]===">"?(a=n??Y,f=-1):m[1]===void 0?f=-2:(f=a.lastIndex-m[2].length,h=m[1],a=m[3]===void 0?U:m[3]==='"'?Ye:Je):a===Ye||a===Je?a=U:a===Ve||a===Ke?a=Y:(a=U,n=void 0);let T=a===U&&s[c+1].startsWith("/>")?" ":"";i+=a===Y?l+_t:f>=0?(r.push(h),l.slice(0,f)+Ze+l.slice(f)+N+T):l+N+(f===-2?c:T)}return[tt(s,i+(s[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),r]},X=class s{constructor({strings:e,_$litType$:t},r){let n;this.parts=[];let i=0,a=0,c=e.length-1,l=this.parts,[h,m]=Ct(e,t);if(this.el=s.createElement(h,r),L.currentNode=this.el.content,t===2||t===3){let f=this.el.content.firstChild;f.replaceWith(...f.childNodes)}for(;(n=L.nextNode())!==null&&l.length<c;){if(n.nodeType===1){if(n.hasAttributes())for(let f of n.getAttributeNames())if(f.endsWith(Ze)){let x=m[a++],T=n.getAttribute(f).split(N),re=/([.?@])?(.*)/.exec(x);l.push({type:1,index:i,name:re[2],strings:T,ctor:re[1]==="."?we:re[1]==="?"?ke:re[1]==="@"?$e:q}),n.removeAttribute(f)}else f.startsWith(N)&&(l.push({type:6,index:i}),n.removeAttribute(f));if(et.test(n.tagName)){let f=n.textContent.split(N),x=f.length-1;if(x>0){n.textContent=ce?ce.emptyScript:"";for(let T=0;T<x;T++)n.append(f[T],Q()),L.nextNode(),l.push({type:2,index:++i});n.append(f[x],Q())}}}else if(n.nodeType===8)if(n.data===Xe)l.push({type:2,index:i});else{let f=-1;for(;(f=n.data.indexOf(N,f+1))!==-1;)l.push({type:7,index:i}),f+=N.length-1}i++}}static createElement(e,t){let r=O.createElement("template");return r.innerHTML=e,r}};function z(s,e,t=s,r){if(e===I)return e;let n=r!==void 0?t._$Co?.[r]:t._$Cl,i=Z(e)?void 0:e._$litDirective$;return n?.constructor!==i&&(n?._$AO?.(!1),i===void 0?n=void 0:(n=new i(s),n._$AT(s,t,r)),r!==void 0?(t._$Co??=[])[r]=n:t._$Cl=n),n!==void 0&&(e=z(s,n._$AS(s,e.values),n,r)),e}var ye=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:r}=this._$AD,n=(e?.creationScope??O).importNode(t,!0);L.currentNode=n;let i=L.nextNode(),a=0,c=0,l=r[0];for(;l!==void 0;){if(a===l.index){let h;l.type===2?h=new ee(i,i.nextSibling,this,e):l.type===1?h=new l.ctor(i,l.name,l.strings,this,e):l.type===6&&(h=new xe(i,this,e)),this._$AV.push(h),l=r[++c]}a!==l?.index&&(i=L.nextNode(),a++)}return L.currentNode=O,n}p(e){let t=0;for(let r of this._$AV)r!==void 0&&(r.strings!==void 0?(r._$AI(e,r,t),t+=r.strings.length-2):r._$AI(e[t])),t++}},ee=class s{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,r,n){this.type=2,this._$AH=d,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=r,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=z(this,e,t),Z(e)?e===d||e==null||e===""?(this._$AH!==d&&this._$AR(),this._$AH=d):e!==this._$AH&&e!==I&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):St(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==d&&Z(this._$AH)?this._$AA.nextSibling.data=e:this.T(O.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:r}=e,n=typeof r=="number"?this._$AC(e):(r.el===void 0&&(r.el=X.createElement(tt(r.h,r.h[0]),this.options)),r);if(this._$AH?._$AD===n)this._$AH.p(t);else{let i=new ye(n,this),a=i.u(this.options);i.p(t),this.T(a),this._$AH=i}}_$AC(e){let t=Qe.get(e.strings);return t===void 0&&Qe.set(e.strings,t=new X(e)),t}k(e){Se(this._$AH)||(this._$AH=[],this._$AR());let t=this._$AH,r,n=0;for(let i of e)n===t.length?t.push(r=new s(this.O(Q()),this.O(Q()),this,this.options)):r=t[n],r._$AI(i),n++;n<t.length&&(this._$AR(r&&r._$AB.nextSibling,n),t.length=n)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let r=We(e).nextSibling;We(e).remove(),e=r}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},q=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,r,n,i){this.type=1,this._$AH=d,this._$AN=void 0,this.element=e,this.name=t,this._$AM=n,this.options=i,r.length>2||r[0]!==""||r[1]!==""?(this._$AH=Array(r.length-1).fill(new String),this.strings=r):this._$AH=d}_$AI(e,t=this,r,n){let i=this.strings,a=!1;if(i===void 0)e=z(this,e,t,0),a=!Z(e)||e!==this._$AH&&e!==I,a&&(this._$AH=e);else{let c=e,l,h;for(e=i[0],l=0;l<i.length-1;l++)h=z(this,c[r+l],t,l),h===I&&(h=this._$AH[l]),a||=!Z(h)||h!==this._$AH[l],h===d?e=d:e!==d&&(e+=(h??"")+i[l+1]),this._$AH[l]=h}a&&!n&&this.j(e)}j(e){e===d?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},we=class extends q{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===d?void 0:e}},ke=class extends q{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==d)}},$e=class extends q{constructor(e,t,r,n,i){super(e,t,r,n,i),this.type=5}_$AI(e,t=this){if((e=z(this,e,t,0)??d)===I)return;let r=this._$AH,n=e===d&&r!==d||e.capture!==r.capture||e.once!==r.once||e.passive!==r.passive,i=e!==d&&(r===d||n);n&&this.element.removeEventListener(this.name,this,r),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},xe=class{constructor(e,t,r){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=r}get _$AU(){return this._$AM._$AU}_$AI(e){z(this,e)}};var Et=_e.litHtmlPolyfillSupport;Et?.(X,ee),(_e.litHtmlVersions??=[]).push("3.3.3");var rt=(s,e,t)=>{let r=t?.renderBefore??e,n=r._$litPart$;if(n===void 0){let i=t?.renderBefore??null;r._$litPart$=n=new ee(e.insertBefore(Q(),i),i,void 0,t??{})}return n._$AI(s),n};var Ee=globalThis,R=class extends A{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=rt(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return I}};R._$litElement$=!0,R.finalized=!0,Ee.litElementHydrateSupport?.({LitElement:R});var At=Ee.litElementPolyfillSupport;At?.({LitElement:R});(Ee.litElementVersions??=[]).push("4.2.2");var E=s=>(e,t)=>{t!==void 0?t.addInitializer(()=>{customElements.define(s,e)}):customElements.define(s,e)};var Pt={attribute:!0,type:String,converter:J,reflect:!1,hasChanged:le},Tt=(s=Pt,e,t)=>{let{kind:r,metadata:n}=t,i=globalThis.litPropertyMetadata.get(n);if(i===void 0&&globalThis.litPropertyMetadata.set(n,i=new Map),r==="setter"&&((s=Object.create(s)).wrapped=!0),i.set(t.name,s),r==="accessor"){let{name:a}=t;return{set(c){let l=e.get.call(this);e.set.call(this,c),this.requestUpdate(a,l,s,!0,c)},init(c){return c!==void 0&&this.C(a,void 0,s,c),c}}}if(r==="setter"){let{name:a}=t;return function(c){let l=this[a];e.call(this,c),this.requestUpdate(a,l,s,!0,c)}}throw Error("Unsupported decorator location: "+r)};function y(s){return(e,t)=>typeof t=="object"?Tt(s,e,t):((r,n,i)=>{let a=n.hasOwnProperty(i);return n.constructor.createProperty(i,r),a?Object.getOwnPropertyDescriptor(n,i):void 0})(s,e,t)}function p(s){return y({...s,state:!0,attribute:!1})}var g=class extends R{constructor(){super(...arguments);this.error=null;this.busy=!1}#r;connectedCallback(){super.connectedCallback(),this.#r=me(()=>this.onSessionChange())}disconnectedCallback(){this.#r?.(),super.disconnectedCallback()}onSessionChange(){this.requestUpdate()}get sdk(){return ze(this.client,this.baseUrl)}get sdkOrNull(){try{return this.sdk}catch{return null}}async run(t){this.error=null,this.busy=!0;try{return await t()}catch(r){if(r instanceof Error&&r.name==="AbortError")return;this.error=Nt(r);return}finally{this.busy=!1}}emit(t,r){this.dispatchEvent(new CustomEvent(t,{detail:r,bubbles:!0,composed:!0}))}static{this.baseStyles=k`
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
  `}};u([y({type:String,attribute:"base-url"})],g.prototype,"baseUrl",2),u([y({attribute:!1})],g.prototype,"client",2),u([p()],g.prototype,"error",2),u([p()],g.prototype,"busy",2);function Nt(s){if(s instanceof v)switch(s.code){case"unauthorized":return"Please sign in again.";case"insufficient_balance":return s.balance===void 0?"Not enough credits.":`Not enough credits \u2014 you have ${s.balance}.`;case"rate_limited":return"Too many attempts. Please wait a moment and try again.";case"network":return"Could not reach the server. Check your connection.";case"timeout":return"This is taking longer than expected. It may still complete.";default:return s.message}return s instanceof Error?s.message:String(s)}var st=de`<svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.909c1.702-1.567 2.683-3.874 2.683-6.614z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.909-2.258c-.806.54-1.837.859-3.047.859-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.346l2.582-2.582C13.463.892 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>`,nt=de`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><g fill="#627EEA"><path d="M12 1.5 5.75 12.02 12 15.73V1.5z" opacity=".55"/><path d="M12 1.5v14.23l6.25-3.71L12 1.5z" opacity=".85"/><path d="M12 17.06 5.75 13.35 12 22.5v-5.44z" opacity=".55"/><path d="M12 22.5v-5.44l6.25-3.71L12 22.5z" opacity=".85"/></g></svg>`,it=de`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="#9C59FF" d="M3 23.9C2.7 23.6 2.8 22.7 3.3 22.1C3.4 21.9 3.4 21.9 3.2 21.9C3 22 2.9 21.9 2.9 21.6C3 21.3 3.4 21 3.9 20.9C4.4 20.8 4.4 20.8 5.2 19.5C5.7 18.9 6.3 18.1 6.5 17.7C6.9 17.2 7 17 7.1 16.8C7.2 16.3 7.4 16 7.9 15.8C8.5 15.6 10.4 13.8 10.2 13.6C10.2 13.6 10 13.6 9.7 13.5C8.7 13.3 7.5 12.8 6.9 12.4C6.6 12.2 6.6 12.2 6.4 12.2C5.6 12.3 4.9 12.5 4.4 12.8C3.8 13.1 3.8 13.2 3.7 13.1C3.6 13 3.6 12.4 3.8 12C3.8 11.9 3.8 11.9 3.7 11.9C3.6 11.9 3.4 12 3.1 12.3C2.7 12.8 2.6 12.8 2.5 12.6C2.3 12.4 2.4 12.1 2.5 11.7C2.6 11.2 2.6 11.2 2.5 11.2C2.4 11.3 2.2 11.4 2 11.4C1.6 11.6 1.5 11.6 1.5 11.4C1.5 10.7 2.3 9.7 3 9.3C3.7 8.9 4.9 8.8 5.2 9C5.3 9.1 5.6 9.2 5.6 9.2C5.6 9.2 5.6 9.1 5.5 9C5.4 8.8 5.4 8.6 5.5 8.6C5.5 8.6 5.9 8.6 6.3 8.6C7.6 8.6 8.1 8.4 9.4 7.8C10.9 7.1 11.1 7 11.7 6.8C12.5 6.5 12.9 6.4 13.9 6.4C15.4 6.3 16 6.5 17.4 7.3C18 7.7 18.1 7.7 18.4 7.6C18.7 7.6 18.8 7.6 19.1 7.6C19.7 7.7 20 7.7 20.4 7.5C21.1 7.1 21.4 6.5 21.3 5.7C21.3 5 21.1 4.7 20.2 4.1C19.1 3.2 18.7 2.5 18.7 1.5C18.7 0.9 18.8 0.6 19.1 0.3C19.5 -0.1 19.9 -0.1 20.6 0.4C21 0.6 21.2 0.7 21.8 0.9C22.6 1.2 22.7 1.2 22.2 1.3C21.8 1.3 21.8 1.3 22.1 1.4C22.7 1.6 22.6 1.7 21.7 1.7C21.1 1.7 20.9 1.7 20.6 1.8C20.1 1.9 20 2 20.1 2.2C20.1 2.5 20.2 2.6 20.9 3.1C22.1 4.1 22.5 4.8 22.5 6C22.4 7.5 21.5 8.7 19.8 9.8C19.2 10.1 19.2 10.1 19.2 10.7C19.2 11.9 19 12.5 18.3 13.1C17.5 13.7 16.6 13.9 15.1 14L14.3 14L14.2 14.2C14.1 14.2 14.1 14.3 14.1 14.4C14.1 14.4 13.8 14.6 13.5 14.8C13.2 15 12.6 15.8 12.9 15.7C12.9 15.7 13.4 15.5 14 15.3C17 14.4 16.7 14.5 17.2 14.5C17.8 14.5 17.8 14.5 18.4 15.4C19 16.3 19.1 16.5 19 16.6C19 16.8 18.5 16.6 18 16.1C17.7 15.8 17.6 15.8 17.7 16.1C17.7 16.4 17.6 16.5 17.4 16.4C17.3 16.3 17.2 16.2 17.1 15.8L17.1 15.5L16.9 15.5C16.6 15.5 16.6 15.5 14.5 16.2C13.3 16.6 12.9 16.7 12.7 16.9C12 17.2 11.5 17 11.5 16.3C11.5 16.1 11.9 14.9 12.1 14.8C12.1 14.8 12.3 14.4 12.2 14.4C12.2 14.4 11.9 14.5 11.6 14.6L11 14.8L10 15.6C9 16.4 9 16.4 8.9 16.6C8.8 17 8.5 17.3 8.1 17.4C7.9 17.5 7.8 17.7 6.9 18.8C5.9 20.1 5.3 20.9 4.9 21.6C4.8 21.8 4.5 22.1 4.3 22.4C3.7 22.9 3.6 23.1 3.3 23.6C3.1 24 3.1 24 3 23.9Z"/></svg>`;var b=class extends Error{constructor(e){super(e),this.name="WalletError"}};function at(){return typeof window>"u"?[]:[{where:"window.nostr",provider:window.nostr},{where:"window.okxwallet.nostr",provider:window.okxwallet?.nostr}]}function Rt(s){let e=s;return!!e&&typeof e.getPublicKey=="function"&&typeof e.signEvent=="function"}function Ae(){for(let{provider:s}of at())if(Rt(s))return s;return null}async function ue(s=2e3){let e=Date.now()+s;for(;;){let t=Ae();if(t)return t;let r=e-Date.now();if(r<=0)return null;await new Promise(n=>setTimeout(n,Math.min(100,r)))}}function Pe(){return at().map(s=>s.where)}function Te(){if(typeof window>"u")return null;for(let s of[window.ethereum,window.okxwallet])if(s&&typeof s.request=="function")return s;return null}function Mt(){return Te()!==null}function Ut(){return Ae()!==null}function Lt(){let s=[];return Mt()&&s.push("eip155"),Ut()&&s.push("nostr"),s}async function Ne(s,e){let t;try{t=JSON.parse(s)}catch{throw new b("server sent an unreadable Nostr challenge")}let{nip19:r,finalizeEvent:n}=await import("./esm-ZDSEP2UJ.js"),i;try{let a=r.decode(e.trim());if(a.type!=="nsec")throw new b(`that is an ${a.type} key \u2014 sign-in needs the secret key, which starts with nsec1`);i=a.data}catch(a){throw a instanceof b?a:new b("that does not look like a valid nsec1\u2026 key")}try{let a=n({kind:t.kind,content:t.content,tags:t.tags,created_at:t.created_at??Math.floor(Date.now()/1e3)},i);return{type:"nostr_event",event:JSON.stringify(a)}}finally{i.fill(0)}}async function D(){let s=Te();if(!s)throw new b("no Ethereum wallet found in this browser");let e;try{e=await s.request({method:"eth_requestAccounts"})}catch(r){throw new b(Me(r,"wallet connection was rejected"))}let t=Array.isArray(e)?e[0]:void 0;if(typeof t!="string"||!t)throw new b("wallet returned no accounts");return t}async function j(s,e){let t=Te();if(!t)throw new b("no Ethereum wallet found in this browser");try{let r=await t.request({method:"personal_sign",params:[s,e]});if(typeof r!="string")throw new b("wallet returned no signature");return{type:"signature",signature:r}}catch(r){throw r instanceof b?r:new b(Me(r,"signature was rejected"))}}async function F(s){let e=await ue();if(!e)throw new b(`no Nostr signer answered (looked at ${Pe().join(", ")})`);let t;try{t=JSON.parse(s)}catch{throw new b("server sent an unreadable Nostr challenge")}t.created_at??=Math.floor(Date.now()/1e3);try{let r=await e.signEvent(t);return{type:"nostr_event",event:JSON.stringify(r)}}catch(r){throw new b(Me(r,"signing was rejected"))}}var Ot=6e4;async function Re(s,e,t={}){let r;try{r=JSON.parse(s)}catch{throw new b("server sent an unreadable Nostr challenge")}let[{BunkerSigner:n,parseBunkerInput:i},{generateSecretKey:a}]=await Promise.all([import("./nip46-PMGLFUAT.js"),import("./pure-F6KPRDZ5.js")]),c=await i(e.trim()).catch(()=>null);if(!c)throw new b("that is not a bunker:// address or a NIP-05 name \u2014 copy the connection string from your signer app");let l=n.fromBunker(a(),c,{onauth:h=>t.onAuthUrl?.(h)});try{let h=await It((async()=>(await l.connect(),l.signEvent({kind:r.kind,content:r.content,tags:r.tags,created_at:r.created_at??Math.floor(Date.now()/1e3)})))(),t.timeoutMs??Ot,"the signer did not respond \u2014 check it is running and try again");return{type:"nostr_event",event:JSON.stringify(h)}}catch(h){throw h instanceof b?h:new b(h instanceof Error?h.message:"the remote signer refused")}finally{await l.close().catch(()=>{})}}function It(s,e,t){return new Promise((r,n)=>{let i=setTimeout(()=>n(new b(t)),e);s.then(a=>{clearTimeout(i),r(a)},a=>{clearTimeout(i),n(a)})})}function Me(s,e){if(s&&typeof s=="object"){let t=s;if(t.code===4001)return e;if(t.message)return t.message}return e}var $=class extends g{constructor(){super(...arguments);this.me=null;this.enabled=null;this.signerTimeout=2e3;this.variant="inline";this.nostrFallback="none";this.nostrHint=null;this.authUrl=null}connectedCallback(){super.connectedCallback(),this.load()}onSessionChange(){this.load()}async load(){let t=await this.run(()=>this.sdk.auth.completeRedirect());if(t&&(this.emit("openapps-login",t),w()),this.enabled||(this.enabled=await this.run(()=>this.sdk.auth.methods())??null),!this.sdk.isLoggedIn){this.me=null;return}this.me=await this.run(()=>this.sdk.auth.me())??null}async loginWithWallet(){await this.run(async()=>{let t=await D(),r=await this.sdk.auth.challenge("eip155",t),n=await j(r.message,t),i=await this.sdk.auth.verify(r.challenge_id,n,{referralCode:te()});this.emit("openapps-login",i),w()})}async loginWithNostr(){if(!await ue(this.signerTimeout)){this.nostrFallback="bunker",this.nostrHint=`No signer extension answered. Checked ${Pe().join(" and ")}. On a phone, or without an extension, connect a remote signer below.`;return}await this.run(async()=>{let t=await this.sdk.auth.challenge("nostr"),r=await F(t.message),n=await this.sdk.auth.verify(t.challenge_id,r,{referralCode:te()});this.emit("openapps-login",n),w()})}async loginWithBunker(t){t.preventDefault();let n=this.renderRoot.querySelector("#bunker")?.value.trim()??"";n&&(this.authUrl=null,await this.run(async()=>{let i=await this.sdk.auth.challenge("nostr"),a=await Re(i.message,n,{onAuthUrl:l=>{this.authUrl=l}}),c=await this.sdk.auth.verify(i.challenge_id,a,{referralCode:te()});this.nostrFallback="none",this.authUrl=null,this.emit("openapps-login",c),w()}))}async loginWithNsec(t){t.preventDefault();let r=this.renderRoot.querySelector("#nsec"),n=r?.value.trim()??"";n&&await this.run(async()=>{try{let i=await this.sdk.auth.challenge("nostr"),a=await Ne(i.message,n),c=await this.sdk.auth.verify(i.challenge_id,a,{referralCode:te()});this.nostrFallback="none",this.emit("openapps-login",c),w()}finally{r&&(r.value="")}})}loginWithGoogle(){let t=`${location.origin}${location.pathname}${location.search}`;window.location.href=this.sdk.auth.googleStartUrl(t,te())}async logout(){await this.run(()=>this.sdk.auth.logout()),this.me=null,this.emit("openapps-logout",null),w()}render(){if(this.me)return this.renderSignedIn(this.me);let t=this.enabled?.google??!1,r=this.enabled?.eip155??!1,n=this.enabled?.nostr??!1;if(this.enabled&&!t&&!r&&!n)return this.frame(o`
        <p class="muted">This server has no login methods configured.</p>
        ${this.error?o`<p class="error" role="alert">${this.error}</p>`:d}
      `);let i=this.variant==="panel"?"block":"";return this.frame(o`
      <div class="stack">
        ${t?o`<button
              class="provider ${i}"
              ?disabled=${this.busy}
              @click=${this.loginWithGoogle}
            >
              ${st}<span>Continue with Google</span>
            </button>`:d}
        ${r?o`<button
              class="provider ${i}"
              ?disabled=${this.busy}
              @click=${this.loginWithWallet}
            >
              ${nt}<span>Continue with a wallet</span>
            </button>`:d}
        ${n?o`
              <button
                class="provider ${i}"
                ?disabled=${this.busy}
                @click=${this.loginWithNostr}
              >
                ${it}<span>Continue with Nostr</span>
              </button>
              ${this.renderNostrFallback()}
            `:d}
        ${this.error?o`<p class="error" role="alert">${this.error}</p>`:d}
      </div>
    `)}frame(t){return this.variant!=="panel"?t:o`
      <div class="panel">
        <div class="head">
          <span class="mark" aria-hidden="true">O</span>
          <h1 class="title">Sign in to OpenApps</h1>
          <p class="desc">
            One account for every app in the suite. Optional — the apps work
            without it.
          </p>
        </div>
        <div class="body">${t}</div>
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
        ${this.nostrHint?o`<p class="muted small">${this.nostrHint}</p>`:d}
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
            </p>`:d}
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
        ${this.nostrHint?o`<p class="muted small">${this.nostrHint}</p>`:d}
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
    `}renderSignedIn(t){let r=t.display_name??t.linked_accounts[0]?.caip10??t.id;return o`
      <div class="row">
        <span class="identity" title=${r}>${Ht(r)}</span>
        <button ?disabled=${this.busy} @click=${this.logout}>Sign out</button>
      </div>
      ${this.error?o`<p class="error" role="alert">${this.error}</p>`:d}
    `}};$.styles=[g.baseStyles,k`
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
    `],u([p()],$.prototype,"me",2),u([p()],$.prototype,"enabled",2),u([y({type:Number,attribute:"signer-timeout"})],$.prototype,"signerTimeout",2),u([y({type:String})],$.prototype,"variant",2),u([p()],$.prototype,"nostrFallback",2),u([p()],$.prototype,"nostrHint",2),u([p()],$.prototype,"authUrl",2),$=u([E("openapps-login")],$);function Ht(s,e=10,t=6){return s.length<=e+t+1?s:`${s.slice(0,e)}\u2026${s.slice(-t)}`}function te(){return typeof location>"u"?void 0:new URLSearchParams(location.search).get("ref")??void 0}var Ue={google:"Google",eip155:"Wallet",nostr:"Nostr"},C=class extends g{constructor(){super(...arguments);this.me=null;this.enabled=null;this.pending=null;this.notice=null;this.blocked=null}connectedCallback(){super.connectedCallback(),this.load()}onSessionChange(){this.load()}async load(){if(await Promise.resolve(),this.handleLinkRedirect(),this.enabled||(this.enabled=await this.run(()=>this.sdk.auth.methods())??null),!this.sdk.isLoggedIn){this.me=null;return}this.me=await this.run(()=>this.sdk.auth.me())??null}linked(t){return(this.me?.linked_accounts??[]).some(r=>r.namespace===t)}get connectable(){return["eip155","nostr"].filter(t=>this.enabled?.[t]&&!this.linked(t))}get canConnectGoogle(){return(this.enabled?.google??!1)&&!this.linked("google")}async connectGoogle(t=!1){await this.run(async()=>{let r=`${location.origin}${location.pathname}${location.search}`,n=await this.sdk.auth.googleLinkStart(r,{merge:t});window.location.href=n})}handleLinkRedirect(){let t;try{t=this.sdk.auth.completeLinkRedirect()}catch{return}if(t)switch(t.status){case"linked":this.notice=t.merged?`Accounts combined \u2014 ${t.credits.toLocaleString()} credits moved across.`:"Google connected.",this.emit("openapps-identity-linked",t),w();break;case"conflict":this.pending={namespace:"google",other:{id:"",balance:t.balance}};break;case"blocked":this.blocked=t.message;break;case"error":this.error=t.message;break}}async connect(t){this.blocked=null,await this.run(async()=>{let r=t==="eip155"?await D():void 0,n=await this.sdk.auth.linkChallenge(t,r),i=t==="eip155"?await j(n.message,r):await F(n.message);try{let a=await this.sdk.auth.linkVerify(n.challenge_id,i);this.afterLink(a)}catch(a){if(a instanceof v&&(a.detail?.code==="merge_blocked_by_duplicate_namespace"||a.detail?.code==="namespace_already_linked")){this.blocked=a.message;return}if(a instanceof v&&a.detail?.code==="identity_belongs_to_another_account"){this.pending={namespace:t,other:a.detail.other_account};return}throw a}})}async confirmMerge(){let t=this.pending;if(t){if(t.namespace==="google"){this.pending=null,await this.connectGoogle(!0);return}await this.run(async()=>{let r=t.namespace==="eip155"?await D():void 0,n=await this.sdk.auth.linkChallenge(t.namespace,r),i=t.namespace==="eip155"?await j(n.message,r):await F(n.message),a=await this.sdk.auth.linkVerify(n.challenge_id,i,{merge:!0});this.pending=null,this.afterLink(a)})}}afterLink(t){this.notice=t.merged?`Accounts combined \u2014 ${(t.credits_transferred??0).toLocaleString()} credits moved across.`:"Connected.",this.emit("openapps-identity-linked",t),w(),this.load()}async unlink(t){await this.run(async()=>{await this.sdk.auth.unlink(t),this.notice="Disconnected.",this.emit("openapps-identity-unlinked",{caip10:t}),await this.load()})}render(){if(!this.sdkOrNull)return o`<p class="muted">Loading…</p>`;if(!this.sdk.isLoggedIn)return o`<p class="muted">Sign in to manage your account.</p>`;if(!this.me)return o`<p class="muted">Loading…</p>`;if(this.pending)return this.renderMergePrompt(this.pending);let t=this.me.linked_accounts;return o`
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
          ${t.map(r=>o`
              <li>
                <span class="tag">${Ue[r.namespace]??r.namespace}</span>
                <code title=${r.caip10}
                  >${zt(r.label??r.caip10)}</code
                >
                ${t.length>1?o`<button
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
                    </button>`:d}
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

        ${this.blocked?o`<p class="warn" role="alert">${this.blocked}</p>`:d}
        ${this.notice?o`<p class="notice">${this.notice}</p>`:d}
        ${this.error?o`<p class="error" role="alert">${this.error}</p>`:d}
      </div>
    `}renderMergePrompt(t){return o`
      <div class="card">
        <h3>Combine two accounts?</h3>
        <p>
          That ${Ue[t.namespace]??t.namespace} identity already
          belongs to another account holding
          <strong>${t.other.balance.toLocaleString()} credits</strong>.
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
        ${this.error?o`<p class="error" role="alert">${this.error}</p>`:d}
      </div>
    `}};C.styles=[g.baseStyles,k`
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
    `],u([p()],C.prototype,"me",2),u([p()],C.prototype,"enabled",2),u([p()],C.prototype,"pending",2),u([p()],C.prototype,"notice",2),u([p()],C.prototype,"blocked",2),C=u([E("openapps-account")],C);function zt(s,e=18,t=8){return s.length<=e+t+1?s:`${s.slice(0,e)}\u2026${s.slice(-t)}`}var G,P=class extends g{constructor(){super(...arguments);this.pollSeconds=0;this.label="Credits";this.balance=null;se(this,G)}connectedCallback(){super.connectedCallback(),this.refresh(),this.pollSeconds>0&&ne(this,G,setInterval(()=>{this.refresh()},this.pollSeconds*1e3))}disconnectedCallback(){M(this,G)&&clearInterval(M(this,G)),super.disconnectedCallback()}onSessionChange(){this.refresh()}async refresh(){let t=this.sdkOrNull;if(!t?.isLoggedIn){this.balance=null;return}let r=await this.run(()=>t.credits.balance());r!==void 0&&(this.balance=r)}render(){return this.sdkOrNull?this.sdk.isLoggedIn?o`
      <span class="wrap">
        <span class="label muted">${this.label}</span>
        <span class="value" aria-live="polite"
          >${this.balance===null?"\u2026":this.balance.toLocaleString()}</span
        >
      </span>
      ${this.error?o`<span class="error" role="alert">${this.error}</span>`:d}
    `:o`<span class="muted">Not signed in</span>`:o`<span class="muted">…</span>`}};G=new WeakMap,P.styles=[g.baseStyles,k`
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
    `],u([y({type:Number,attribute:"poll-seconds"})],P.prototype,"pollSeconds",2),u([y({type:String})],P.prototype,"label",2),u([p()],P.prototype,"balance",2),P=u([E("openapps-credits")],P);function ot(s){return new Date(s*1e3).toLocaleDateString(void 0,{day:"numeric",month:"short"})}var _=class extends g{constructor(){super(...arguments);this.info=null;this.earnings=null;this.referees=null;this.tab="link";this.copied=!1}connectedCallback(){super.connectedCallback(),this.load()}onSessionChange(){this.load()}async load(){let t=this.sdkOrNull;if(!t?.isLoggedIn){this.info=null,this.earnings=null,this.referees=null;return}this.info=await this.run(()=>t.referral.code())??null,this.earnings=await this.run(()=>t.referral.earnings())??null,this.referees=await this.run(()=>t.referral.referees())??null}get link(){let t=this.inviteUrl??(typeof location>"u"?"":`${location.origin}${location.pathname}`);if(!this.info)return t;let r=t.includes("?")?"&":"?";return`${t}${r}ref=${encodeURIComponent(this.info.code)}`}async copy(){try{await navigator.clipboard.writeText(this.link),this.copied=!0,setTimeout(()=>this.copied=!1,2e3)}catch{this.error="Could not copy. Select the link and copy it manually."}}render(){if(!this.sdkOrNull)return o`<p class="muted">Loading…</p>`;if(!this.sdk.isLoggedIn)return o`<p class="muted">Sign in to get your invite link.</p>`;if(!this.info)return o`<p class="muted">${this.error??"Loading\u2026"}</p>`;let t=this.referees?.referees??[],r=this.earnings?.entries??[],n=[["link","Your link"],["referees",`Referees${t.length?` (${t.length})`:""}`],["earnings",`Earnings${r.length?` (${r.length})`:""}`]];return o`
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
        ${this.tab==="link"?this.renderLink():this.tab==="referees"?this.renderReferees(t):this.renderEarnings(r)}
        ${this.error?o`<p class="error" role="alert">${this.error}</p>`:d}
      </div>
    `}renderLink(){let t=this.earnings?.total??0,r=this.earnings?.entries.length??0;return o`
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
        <span class="total mono">${t.toLocaleString()}</span>
        <span class="caption">
          ${r===0?"No referred purchases yet.":`credits from ${r} purchase${r===1?"":"s"}`}
        </span>
      </div>
    `}renderReferees(t){return t.length===0?o`<p class="muted">
        Nobody has signed up through your link yet.
      </p>`:o`
      <p class="caption">
        Handles only — signing up through a link does not share someone's
        identity with you.
      </p>
      <div class="list">
        ${t.map(r=>o`
            <div class="item">
              <span class="mono handle">${r.handle}</span>
              <span class="grow caption">
                joined ${ot(r.joined_at)} ·
                ${r.purchases===0?"no purchases yet":`${r.purchases} purchase${r.purchases===1?"":"s"}`}
              </span>
              <span class="mono amount ${r.earned>0?"good":""}">
                ${r.earned>0?`+${r.earned.toLocaleString()}`:"\u2014"}
              </span>
            </div>
          `)}
      </div>
    `}renderEarnings(t){return t.length===0?o`<p class="muted">
        No referral earnings yet. A bonus is credited when a referee's
        purchase settles.
      </p>`:o`
      <p class="caption">
        Each row is one bonus, credited in the same transaction as the
        referee's purchase — so this list and your balance cannot disagree.
      </p>
      <div class="list">
        ${t.map(r=>o`
            <div class="item">
              <span class="mono date">${ot(r.created_at)}</span>
              <span class="grow caption">
                ${r.referee??"unknown"}
                ${r.referee_credits?o` bought ${r.referee_credits.toLocaleString()} credits`:d}
              </span>
              <span class="mono amount good">+${r.amount.toLocaleString()}</span>
            </div>
          `)}
      </div>
    `}};_.styles=[g.baseStyles,k`
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
    `],u([y({type:String,attribute:"invite-url"})],_.prototype,"inviteUrl",2),u([p()],_.prototype,"info",2),u([p()],_.prototype,"earnings",2),u([p()],_.prototype,"referees",2),u([p()],_.prototype,"tab",2),u([p()],_.prototype,"copied",2),_=u([E("openapps-referral")],_);var H,S=class extends g{constructor(){super(...arguments);this.rails="";this.packages=null;this.selected=null;this.instruction=null;this.topup=null;this.waiting=!1;se(this,H)}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){M(this,H)?.abort(),super.disconnectedCallback()}onSessionChange(){if(!this.packages){this.load();return}this.requestUpdate()}async load(){if(!this.sdkOrNull)return;let t=await this.run(()=>this.sdk.payments.packages());t&&(this.packages=t)}get offeredRails(){if(!this.packages)return[];let t=["stripe","ethereum","lightning"].filter(n=>this.packages?.rails?.[n]),r=this.rails.split(",").map(n=>n.trim()).filter(Boolean);return r.length?t.filter(n=>r.includes(n)):t}async start(t){let r=this.selected;r&&await this.run(async()=>{let n;switch(t){case"stripe":{let i=await this.sdk.payments.stripeCheckout(r.id);this.instruction={kind:"redirect"},window.location.href=i.checkout_url;return}case"ethereum":{let i=await this.sdk.payments.ethDepositAddress(r.id);n=i.topup_id,this.instruction={kind:"address",chain:i.chain,address:i.address,amount:i.expected_amount};break}case"lightning":{let i=await this.sdk.payments.lightningInvoice(r.id);n=i.topup_id,this.instruction={kind:"invoice",bolt11:i.bolt11,amountMsat:i.amount_msat};break}}this.watch(n,Dt[t])})}async watch(t,r){M(this,H)?.abort();let n=new AbortController;ne(this,H,n),this.waiting=!0;try{let i=await this.sdk.payments.waitFor(t,{timeoutMs:r,signal:n.signal,onPoll:a=>{this.topup=a}});this.topup=i,i.status==="confirmed"&&(this.emit("openapps-topup",i),w())}catch(i){i instanceof Error&&i.name==="AbortError"||(this.error=Wt(i))}finally{this.waiting=!1}}reset(){M(this,H)?.abort(),this.selected=null,this.instruction=null,this.topup=null,this.error=null}render(){return this.sdkOrNull?this.sdk.isLoggedIn?this.packages?this.instruction?this.renderInstruction(this.instruction):this.selected?this.renderRails(this.selected):this.renderPackages(this.packages.packages??[]):o`<p class="muted">${this.error??"Loading packages\u2026"}</p>`:o`<p class="muted">Sign in to buy credits.</p>`:o`<p class="muted">Loading…</p>`}renderPackages(t){return t.length===0?o`<p class="muted">No credit packages are configured.</p>`:o`
      <div class="grid">
        ${t.map(r=>o`
            <button class="package" @click=${()=>this.selected=r}>
              <span class="credits">
                ${r.credits.toLocaleString()} credits
              </span>
              <span class="perunit caption">${Ft(r)}</span>
              <span class="price">${lt(r.usd_price)}</span>
            </button>
          `)}
      </div>
      ${this.error?o`<p class="error" role="alert">${this.error}</p>`:d}
    `}renderRails(t){let r=this.offeredRails;return o`
      <p>
        <strong>${t.credits.toLocaleString()} credits</strong> —
        ${lt(t.usd_price)}
      </p>
      <div class="stack">
        ${r.map(n=>o`
            <button class="primary" ?disabled=${this.busy} @click=${()=>this.start(n)}>
              ${qt[n]}
            </button>
          `)}
        ${r.length===0?o`<p class="muted">No payment methods are enabled.</p>`:d}
        <button @click=${this.reset}>Back</button>
      </div>
      ${this.error?o`<p class="error" role="alert">${this.error}</p>`:d}
    `}renderInstruction(t){let r=this.topup?.status??"pending";return r==="confirmed"?o`
        <span class="badge success"><span class="dot"></span>Confirmed</span>
        <p class="ok">Payment confirmed — credits added.</p>
        <button @click=${this.reset}>Buy more</button>
      `:r==="failed"||r==="expired"?o`
        <span class="badge danger"><span class="dot"></span>${r==="failed"?"Failed":"Expired"}</span>
        <p class="error" role="alert">This top-up ${r}. Nothing was charged.</p>
        <button @click=${this.reset}>Try again</button>
      `:o`
      ${t.kind==="redirect"?o`<p class="muted">Redirecting to checkout…</p>`:d}
      ${t.kind==="address"?o`
            <p>Send exactly <strong>${Gt(t.amount,6)}</strong> USDC or
            USDT on <code>${t.chain}</code> to:</p>
            <code class="payload">${t.address}</code>
          `:d}
      ${t.kind==="invoice"?o`
            <p>Pay this Lightning invoice
            (<strong>${Math.ceil(t.amountMsat/1e3).toLocaleString()} sats</strong>):</p>
            <code class="payload">${t.bolt11}</code>
          `:d}
      ${t.kind!=="redirect"?o`
            <div class="row">
              <button @click=${()=>this.copy(jt(t))}>Copy</button>
              <button @click=${this.reset}>Cancel</button>
            </div>
            ${this.renderWaiting()}
          `:d}
      ${this.error?o`<p class="error" role="alert">${this.error}</p>`:d}
    `}renderWaiting(){if(!this.waiting)return o`<p class="muted" aria-live="polite">Not watching for payment.</p>`;let t=this.topup?.confirmations;if(t===void 0)return o`<p class="muted" aria-live="polite">Waiting for payment…</p>`;let r=this.topup?.confirmations_required;if(r==null)return o`
        <p class="muted" aria-live="polite">
          Payment received — waiting for the network to finalise it.
        </p>
      `;let n=Math.min(t,r);return o`
      <p class="muted" aria-live="polite">
        Payment received — confirming (${n} of ${r}).
      </p>
      <progress
        class="confirms"
        max=${r}
        value=${n}
        aria-label="Confirmations"
      ></progress>
    `}async copy(t){try{await navigator.clipboard.writeText(t)}catch{this.error="Could not copy \u2014 select the text and copy it manually."}}};H=new WeakMap,S.styles=[g.baseStyles,k`
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
    `],u([y({type:String})],S.prototype,"rails",2),u([p()],S.prototype,"packages",2),u([p()],S.prototype,"selected",2),u([p()],S.prototype,"instruction",2),u([p()],S.prototype,"topup",2),u([p()],S.prototype,"waiting",2),S=u([E("openapps-buy")],S);var qt={stripe:"Pay by card",ethereum:"Pay with USDC / USDT",lightning:"Pay with Lightning"},Dt={stripe:void 0,lightning:void 0,ethereum:1800*1e3};function jt(s){return s.kind==="address"?s.address:s.kind==="invoice"?s.bolt11:""}function lt(s){return`$${(s/100).toFixed(2)}`}function Ft(s){if(s.credits<=0)return"";let e=s.usd_price/s.credits;return`${e<1?e.toFixed(2):e.toFixed(1)}\xA2 each`}function Gt(s,e){let t=10**e;return(s/t).toFixed(e).replace(/\.?0+$/,"")}function Wt(s){let e=s instanceof Error?s.message:String(s);return e.includes("still pending")?"Still waiting on the network. Your credits will appear once the payment settles.":e}export{C as OpenAppsAccount,S as OpenAppsBuy,P as OpenAppsCredits,g as OpenAppsElement,$ as OpenAppsLogin,_ as OpenAppsReferral,b as WalletError,Lt as availableNamespaces,He as configure,D as connectEthereum,Ae as findNostrProvider,mt as getClient,w as notify,me as onChange,F as signNostr,Re as signNostrWithBunker,Ne as signNostrWithSecretKey,j as signSiwe,ue as waitForNostrProvider};
//# sourceMappingURL=openapps-ui.js.map
