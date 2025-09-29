export default function debounce<T extends (...args:any[])=>any>(fn:T, wait:number){
  let t: any;
  return (...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), wait);
  }
}
