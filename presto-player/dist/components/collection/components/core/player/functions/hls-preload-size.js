import{isHLS}from"./util";export default({src:t,el:e,preload:l,currentTime:i})=>{if((!e||!e.getAttribute("hls_loaded"))&&["metadata","none"].includes(l)&&isHLS(t)){if(i>0)return e.style.height=null,e.style.paddingBottom=null,void e.setAttribute("hls_loaded","1");e.style.height="0px",e.style.paddingBottom="56.25%"}};