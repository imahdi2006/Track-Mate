export function ThemeScript() {
  const js = `(function(){try{var t=localStorage.getItem("pagemate-theme");if(t!=="light")t="dark";var r=document.documentElement;r.classList.remove("light","dark");r.classList.add(t);r.style.colorScheme=t;}catch(e){}})();`;
  return (
    <script
      dangerouslySetInnerHTML={{ __html: js }}
    />
  );
}
