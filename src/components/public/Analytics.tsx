import Script from "next/script";

/**
 * Tags de marketing do site público (NÃO renderizar no admin):
 *  - Google Tag Manager (GTM-M48KNX4C)
 *  - GA4 direto (G-M6D4NYSHM3)
 *  - Meta Pixel (1426004342688984)
 *
 * IDs são públicos por natureza (aparecem no HTML de qualquer visitante) —
 * hardcoded de propósito. Atenção: se o container do GTM também disparar
 * GA4/Pixel internamente, remover os diretos daqui pra não duplicar eventos.
 */
const GTM_ID = "GTM-M48KNX4C";
const GA4_ID = "G-M6D4NYSHM3";
const META_PIXEL_ID = "1426004342688984";
/** Umami self-hosted (metricas.casaroxa.com.br) — painel interno de visitas. */
const UMAMI_WEBSITE_ID = "e8dd3a47-4aad-4752-a2d0-f7eb1198bb00";

export function Analytics() {
  return (
    <>
      {/* Umami (self-hosted, sem cookies) */}
      <Script
        src="https://metricas.casaroxa.com.br/script.js"
        data-website-id={UMAMI_WEBSITE_ID}
        strategy="afterInteractive"
      />

      {/* Google Tag Manager */}
      <Script id="gtm" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>

      {/* GA4 (gtag.js) */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_ID}');`}
      </Script>

      {/* Meta Pixel */}
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>

      {/* Fallbacks noscript (GTM + Pixel) */}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
          title="gtm"
        />
      </noscript>
    </>
  );
}
