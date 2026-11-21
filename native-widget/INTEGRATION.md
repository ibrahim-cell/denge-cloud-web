# Denge Android Ana Ekran Widget'ı — 4. Aşama

## Widget davranışı

- Kompakt boyut: toplam hesap bakiyesi, Nakit ve Banka.
- Geniş boyut: kompakt bilgilere ek olarak bu ayki Gelir ve Gider toplamları.
- Açık/koyu görünüm, uygulamanın etkin temasından alınır.
- Widget'a dokunulduğunda Denge uygulaması açılır.
- Widget, uygulama her kaydettiğinde veya bulut verisi uygulamaya alındığında güncellenir. Zamanlayıcı veya polling kullanmaz; pil tüketimi için arka planda periyodik sorgu yapmaz.
- Son değerler Android SharedPreferences içinde tutulur; uygulama kapalıyken widget son bilinen özetini göstermeye devam eder.

## Kaynak dosyaları

Bu klasördeki src/main ağacını mevcut Android Studio projesinin app/src/main klasörüne kopyala. Kotlin kaynak paketi com.denge.widget şeklindedir; uygulamanın applicationId değerinden bağımsız kullanılabilir. Gradle namespace değerin com.denge.widget değilse Kotlin dosyasına kendi namespace'in için import <uygulama.namespace>.R satırını ekle.

## Manifest

AndroidManifest.snippet.xml içindeki receiver kaydını mevcut app/src/main/AndroidManifest.xml dosyasının application bloğuna ekle. Manifest dosyasını tümden değiştirme.

## Mevcut AndroidBridge'e bağlantı

Denge WebView zaten AndroidBridge adıyla JavaScript arayüzü sunuyor. Aynı köprü nesnesine aşağıdaki metodu ekle; ikinci bir addJavascriptInterface(..., "AndroidBridge") çağrısı oluşturma:

```kotlin
@JavascriptInterface
fun updateHomeWidget(payload: String) {
    DengeHomeWidgetProvider.updateFromJson(
        applicationContext,
        payload
    )
}
```

Köprü sınıfında applicationContext doğrudan erişilebilir değilse mevcut Context alanını kullan: context.applicationContext.

WebView yalnızca uygulamanın güvenilir yerel https://appassets.androidplatform.net/ içeriğini açarken bu köprü etkin olmalı. Uzak web sayfalarında native JavaScript arayüzünü açık bırakma.

## Web tarafı veri sözleşmesi

index.html kaydetme/render akışından AndroidBridge.updateHomeWidget(JSON.stringify(payload)) çağrısını yapar. Payload alanları:

- balance: mevcut totalRealAccountBalance() sonucu, uygulama para birimi biçiminde
- cash, bank: mevcut hesap bakiyeleri
- income, expense: içinde bulunulan ayın gelir ve gider toplamları
- currency: uygulama para birimi kodu
- theme: light veya dark
- updatedAt: ISO-8601 zaman damgası

Widget ayrı bir finans hesabı veya ikinci hesaplama motoru oluşturmaz; mevcut Denge hesaplama fonksiyonlarının biçimlendirilmiş özetini gösterir. Gelir/gider, hesap, transfer, borç/alacak ve silme kayıtları widget kaynağında değiştirilmez.

## Sınırlama / doğrulama

Bağlı GitHub deposu şu anda statik web/PWA dosyalarını içeriyor; Android Studio app modülü, AndroidManifest.xml, Gradle yapılandırması ve mevcut AndroidBridge sınıfı bu depoda bulunmuyor. Bu nedenle widget'ın Kotlin ve kaynak XML dosyaları burada hazırlanmıştır, ancak mevcut APK'ya derlenip yüklenmiş değildir. Android projesine bu kaynaklar eklendikten sonra gerçek cihazda widget ekleme, yeniden boyutlandırma, tema, bakiye güncelleme ve uygulama açma testleri yapılmalıdır.
