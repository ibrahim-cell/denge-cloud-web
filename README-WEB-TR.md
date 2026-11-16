# Denge Cloud 1.1.0 — Android + Chrome + Çevrimdışı Eşitleme

Bu sürüm, yüklenen `Denge-App-1.0.4.zip` temel alınarak hazırlanmıştır. Mevcut finans uygulaması, `denge-v3` veri biçimi ve işlem ekranları korunmuştur. Bulut bağlantısı kullanıcıya ait Supabase projesiyle yapılandırıldıktan sonra etkinleşir.

## Paketin içeriği

- `app/`: Android Studio projesi. WebView artık `https://appassets.androidplatform.net/assets/index.html` güvenli yerel kökeninde açılır.
- `web/`: Chrome/PC ve PWA için yayımlanacak statik web sürümü.
- `supabase/schema.sql`: Kullanıcıya özel RLS korumalı bulut tablo ve sürüm kontrollü eşitleme fonksiyonu.
- `app/src/main/assets/cloud-config.js`: Supabase URL ve Publishable Key yapılandırma dosyası.
- `app/src/main/assets/cloud-sync.js`: E-posta/şifre girişi, yerel kayıt kuyruğu, iki yönlü eşitleme, sürüm çakışma kontrolü.
- `app/src/main/assets/service-worker.js`: Web sürümü için uygulama kabuğu önbelleği.

## 1. Supabase projesini hazırlama

1. https://supabase.com adresinde bir proje oluştur.
2. Dashboard → SQL Editor → New query yolunu aç.
3. `supabase/schema.sql` dosyasının tamamını yapıştırıp çalıştır.
4. Dashboard → Project Settings → API bölümünden **Project URL** ve **Publishable key** (eski projelerde anon key) değerlerini al.
5. Authentication → Providers → Email bölümünde Email sağlayıcısını açık tut. E-posta doğrulaması açık ise kayıt sırasında kullanıcıya doğrulama e-postası gönderilir.

**Güvenlik:** `service_role`, `secret` veya veritabanı parolası uygulamaya yazılmamalıdır. İstemciye yalnızca Project URL ve Publishable/anon key konur. RLS politikaları kullanıcıların yalnızca kendi `user_id` satırına erişmesini sağlar.

## 2. Supabase ayarını ekleme

Aşağıdaki iki dosyayı da aynı değerlerle güncelle:

- `app/src/main/assets/cloud-config.js`
- `web/cloud-config.js`

Örnek biçim:

```js
window.DENGE_CLOUD_CONFIG = Object.freeze({
  url: 'https://PROJECT_REF.supabase.co',
  publishableKey: 'sb_publishable_...'
});
```

Bu değerler olmadan uygulama yerel/çevrimdışı çalışır; bulut hesabı ve eşitleme etkinleşmez.

## 3. Chrome / PC sürümünü yayımlama

`web/` klasörünün içeriğini HTTPS destekleyen statik bir hosta yükle. Örneğin Vercel, Netlify veya GitHub Pages kullanılabilir. Kök dizinde `index.html`, `cloud-config.js`, `cloud-sync.js`, `service-worker.js`, `site.webmanifest` ve `assets/` klasörü birlikte bulunmalı.

Yayımlanan HTTPS adresini PC Chrome'da aç. Chrome menüsündeki **Denge'yi yükle / Uygulamayı yükle** seçeneğiyle masaüstüne kurabilirsin. PWA Service Worker yalnızca güvenli HTTPS kökeninde kayıt edilir.

## 4. Android sürümünü derleme

1. `Denge-Cloud-1.1.0` klasörünü Android Studio ile aç.
2. Gradle Sync yap.
3. `app/src/main/assets/cloud-config.js` dosyasındaki Supabase ayarlarının girildiğini kontrol et.
4. Build → Build APK(s) ile APK oluştur veya Run ile cihaza yükle.

Manifest'e INTERNET izni eklendi. Android WebView dosyaları `file://` yerine yerel HTTPS benzeri `appassets.androidplatform.net` kökeninden yüklenir; böylece Supabase isteklerinde modern origin/CORS davranışı kullanılır.

### 1.0.4'ten veri taşıma

İlk Android açılışında uygulama, eski `file:///android_asset/index.html` WebView kökenindeki `denge-v3` kaydını bir defa okumayı dener. JSON, Android SharedPreferences üzerinden yeni güvenli WebView kökenine taşınır; eski kayıt silinmez. İlk kurulum/upgrade sonrasında Ana Sayfa'da eski gelir, gider, borç, hesap ve hedeflerin göründüğünü doğrula. Her ihtimale karşı güncellemeden önce Ayarlar → Yedekle üzerinden JSON yedeği almak önerilir.

## 5. Hesap ve eşitleme kullanımı

1. Android veya Chrome'da Ayarlar → Denge Cloud → E-posta ile giriş / kayıt bölümünü aç.
2. Aynı e-posta ve şifreyle her iki platformda da giriş yap.
3. İlk girişte mevcut yerel finans verileri buluta aktarılır veya mevcut bulut verileriyle birleştirilir.
4. Bir cihazda yapılan değişiklik önce cihazda saklanır, sonra internet varsa buluta gönderilir.
5. Diğer açık cihazlar değişiklikleri yaklaşık 12 saniyelik aralıklarla kontrol eder. Uygulama yeniden görünür olduğunda da kontrol yapılır.
6. İnternet yokken kayıt girilebilir. Bağlantı geri gelince bekleyen son durum gönderilir ve diğer cihazlardan alınan değişikliklerle üç yönlü birleştirme yapılır.

### Buluta eşitlenen veriler

İşlemler (gelir/gider/transfer/borç), hesaplar, kategoriler, kategori ikonları, bütçeler, hedefler, borç/alacak listesi, tekrarlayan işlemler ve normal uygulama tercihleri eşitlenir.

Güvenlik PIN'i/hash'i ve profil fotoğrafı cihazda kalır; bunlar buluta gönderilmez. Uygulama teması ve para birimi hesap tercihleri olarak senkronize edilir.

## Çevrimdışı çalışma ve sınırlar

- Mevcut finans verisi her kayıt sırasında `localStorage` alanına yazılır. Bulut erişimi yoksa da uygulama yerel çalışmaya devam eder.
- Kullanıcı girişi/ilk hesap oluşturma için internet gerekir.
- Tarayıcı önbelleği uygulama kabuğunu çevrimdışı açmaya yardımcı olur. Dinamik Supabase istekleri Service Worker tarafından önbelleğe alınmaz.
- Uygulama açıkken veya yeniden öne geldiğinde bağlantı olayı senkronizasyonu başlatır. Bu sürüm uygulama tamamen kapalıyken arka plan eşitlemesi/Background Sync çalıştırmaz; çevrimdışı sıradaki kayıtlar uygulama yeniden açıldığında gönderilir.
- Chrome PC ve Android uygulamasının yerel depoları farklıdır; ilk kez ortak veriye ulaşmaları için her ikisinde de aynı Denge Cloud hesabına giriş yapılmalıdır.
- Senkronizasyon aralığı yaklaşık 12 saniyedir; bu sürüm gerçek zamanlı WebSocket aboneliği kullanmaz.
- Aynı alan iki cihazda çevrimdışıyken farklı biçimde değiştirilirse üç yönlü birleştirme yerel değeri tercih eder; bu nedenle ilk canlı kullanımdan önce test hesaplarıyla çakışma ve veri aktarım testleri yapılmalıdır.

## Test kontrol listesi

- [ ] Supabase SQL çalıştırıldı; `denge_cloud_state` tablosu ve `denge_sync_state` fonksiyonu oluştu.
- [ ] Kullanıcı A ile e-posta kaydı/giriş başarılı.
- [ ] Android'de bir gelir eklendi; Chrome'da görünmesi doğrulandı.
- [ ] Chrome'da bir gider eklendi; Android'de görünmesi doğrulandı.
- [ ] İnternet kapalıyken gelir/gider eklendi; bağlantı gelince eşitlendi.
- [ ] İki cihazda farklı işlem eklenirken kayıt kaybı oluşmadı.
- [ ] İki ayrı kullanıcıyla giriş yapıldığında kullanıcı verileri birbirine karışmadı.
- [ ] Android 1.0.4'ten yükseltme testinde eski `denge-v3` verileri korundu.
- [ ] Yedekleme ve geri yükleme hâlâ çalışıyor.

## Durum

Bu paket uygulama kodu, SQL şeması ve yayın dosyalarını hazırlar. Supabase projesi ChatGPT tarafından senin adına oluşturulmadı ve Project URL/Publishable Key henüz eklenmedi. Bu nedenle bulut eşitlemesi, bu iki değeri girip SQL'i çalıştırmadan gerçek hesapla kullanılamaz. Android APK derlemesi ve iki fiziksel cihazda uçtan uca test ayrıca yapılmalıdır.


## Supabase projesine bağlandı (1.1.1 yapılandırması)
- Proje URL ve public Publishable Key, Android ve Web cloud-config.js dosyalarına işlendi.
- Bu anahtar istemci tarafında kullanılabilen publishable anahtardır; service_role/secret key kullanılmaz.
- Hesap oluşturma testinden önce Auth > URL Configuration bölümünde gerçek web yayın adresini Site URL olarak ayarlayın.
- Redirect allow listesine web yayın adresi ve gerekli Android dönüş adresleri eklendikten sonra e-posta doğrulamasını test edin.
