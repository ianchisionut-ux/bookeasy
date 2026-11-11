let loading: Promise<any> | null = null
export function loadOsmMap(): Promise<any> {
  const browser=window as Window & {L?:any}
  if(browser.L)return Promise.resolve(browser.L)
  if(loading)return loading
  loading=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-bookeasy-leaflet]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/leaflet/leaflet.css';css.dataset.bookeasyLeaflet='true';document.head.appendChild(css)
    }
    const script=document.createElement('script');script.src='/vendor/leaflet/leaflet.js';script.async=true
    script.onload=()=>resolve(browser.L)
    script.onerror=()=>{script.remove();loading=null;reject(new Error('map_load_failed'))}
    document.head.appendChild(script)
  });return loading
}
export function addOsmTiles(L:any,map:any){return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors · Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a>'}).addTo(map)}
export function locationPin(L:any){return L.divIcon({className:'',html:'<span style="display:block;width:26px;height:26px;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0e9aa7;box-shadow:0 2px 5px #0005"></span>',iconSize:[30,36],iconAnchor:[15,34]})}
