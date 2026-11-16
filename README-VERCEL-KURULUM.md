# Denge Cloud Web — Vercel yayın paketi

Bu paket statik HTML/PWA uygulamasıdır. Uygulama kökünde `index.html` bulunur; ek bir build adımı gerektirmez.

## Vercel'e bağlama

1. Bu klasörün tüm içeriğini yeni bir GitHub deposunun köküne yükleyin.
2. Vercel Dashboard → Add New → Project yolundan bu depoyu içe aktarın.
3. Framework Preset: **Other**.
4. Root Directory: `./`.
5. Build Command: boş / Override kapalı.
6. Output Directory: boş / Override kapalı (Vercel kök dizindeki statik dosyaları sunar).
7. Deploy.

Yayın adresi oluştuktan sonra Supabase Authentication → URL Configuration bölümünde Site URL olarak `https://<vercel-domain>` girin. Redirect URL listesine aynı kökeni ve gerekli uygulama dönüş yollarını ekleyin.

## Yapılandırma

`cloud-config.js` içinde yalnızca Supabase Project URL ve public Publishable Key vardır. `service_role`/secret key içermez.
