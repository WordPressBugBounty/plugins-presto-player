import{proxyCustomElement,HTMLElement,h}from"@stencil/core/internal/client";const prestoSpinnerCss=":host{position:relative;box-sizing:border-box;--track-color:#0d131e20;--indicator-color:var(--plyr-color-main);--stroke-width:2px;display:inline-flex}:host *,:host *:before,:host *:after{box-sizing:inherit}.spinner{display:inline-block;width:1em;height:1em;border-radius:50%;border:solid var(--stroke-width) var(--track-color);border-top-color:var(--indicator-color);border-right-color:var(--indicator-color);animation:1s linear infinite spin}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}",PrestoPlayerSpinnerStyle0=prestoSpinnerCss,PrestoSpinner=proxyCustomElement(class extends HTMLElement{constructor(){super(),this.__registerHost(),this.__attachShadow()}render(){return h("span",{key:"159a7d02b47ee7031c1848d0a2c050127e9a584b",part:"base",class:"spinner","aria-busy":"true","aria-live":"polite"})}static get style(){return PrestoPlayerSpinnerStyle0}},[1,"presto-player-spinner"]);function defineCustomElement(){"undefined"!=typeof customElements&&["presto-player-spinner"].forEach((e=>{"presto-player-spinner"===e&&(customElements.get(e)||customElements.define(e,PrestoSpinner))}))}export{PrestoSpinner as P,defineCustomElement as d};