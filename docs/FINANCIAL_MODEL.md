# Denge finansal veri modeli

Bu belge, bakiye hesaplarının hangi kayıtlardan üretildiğini ve tarihli sorguların sınırlarını açıklar. Finansal ekranlarda ayrı ayrı bakiye formülü oluşturulmaz; hesaplama uygulamanın ortak bakiye fonksiyonlarından yapılır.

## 1. Tek bakiye kaynağı

Hesap bakiyesi işlem defterinden türetilir:

- Hesabın `openingBalance` alanı, hesap açılışındaki başlangıç bakiyesidir.
- Gelir ve gider kayıtları imzalı tutar taşır. Gelir artı, gider eksi tutardır.
- Transfer, kaynak hesaptan düşer ve hedef hesaba eklenir; tek bir transfer kaydı iki tarafı birlikte temsil eder.
- Ekranlarda gösterilen bakiye, bu açılış değeri ve ilgili işlem kayıtları toplanarak üretilir. İşlem kaydederken ayrıca `account.balance` üzerine ikinci kez ekleme/çıkarma yapılmaz.
- `balance` alanı eski veri biçimleriyle uyumluluk için tutulur. Yeni işlemlerin çalışma zamanı bakiye kaynağı değildir.

Ana sayfa, Hesaplar, Net Varlık ve ilgili özetler aynı ortak hesaplama sonuçlarını kullanmalıdır.

## 2. Kredi kartı modeli

Kredi kartında `openingBalance`, kartın açılış tarihindeki kullanılabilir limit tutarıdır; toplam borç değildir.

- Açılışta kullanılabilir tutar = toplam limit − açılış borcu.
- Kart gideri kullanılabilir limiti azaltır.
- Kart iadesi veya karta gelir olarak kaydedilen pozitif hareket kullanılabilir limiti artırır.
- Kart borcu = toplam limit − kullanılabilir limit. Kullanılabilir limit eksiye inerse limit aşımı da borç hesabına dahil edilir.
- `creditOpeningBalanceSet` eski kartların açılış davranışını ayırt etmek için kullanılır.

Limit değişikliği açılış bakiyesini yeniden yazmaz. Her değişiklik `creditLimitHistory` içine tarihli olay olarak eklenir. Olaydaki `delta`, kullanılabilir limit üzerinde aynı yönde etki yapar. Böylece limit artışı borcu silmez; yalnızca kullanılabilir limiti artırır. Geçmiş tarih sorguları da o tarihe kadar oluşmuş limit olaylarını uygular.

Kredi kartı hesabının türü doğrudan başka hesap türüne çevrilmez; kart borcunun/limit defterinin yanlış sınıflandırılmaması için ayrı hesap açılmalıdır.

## 3. Tarih bazlı bakiye

Net Varlık Geçmişi ekranındaki tarih seçimi, seçilen gün sonuna kadar kayıtlı işlemleri ve o güne kadar geçerli kredi kartı limit olaylarını hesaplar.

- İşlem tarihi seçilen tarihten sonraysa hesaba katılmaz.
- Transferde kaynak ve hedef hesap aynı tarih kuralıyla güncellenir.
- Hesabın `createdAt` tarihi seçilen günden sonraysa hesap o gün mevcut kabul edilmez.
- Tarih çözünürlüğü gün seviyesindedir; aynı gün içindeki saat/sıra farkı ayrı bir geçmiş bakiye olarak modellenmez.
- Tarihli hesap özeti, kişisel Borç/Alacak defterini ayrıca varlık veya borç olarak eklemez. Bu rapor, hesapların net etkisini gösterir.

### Eski veriler

Eski hesap kayıtlarında `createdAt` veya kredi kartı limit geçmişi bulunmayabilir. Oluşturulma tarihi olmayan eski hesaplar geçmiş sorgusunda mevcut kabul edilir ve ekranda bu varsayım açıklanır. Eksik tarihleri uygulama kendiliğinden tahmin etmez.

Eski kredi kartlarında ilk limit düzenlemesinde eski limit açılış noktası olarak sabitlenir; önceki kayıtlar yeniden yazılmaz. Eski yedeklerde eksik açılış alanları ayrıca doğrulanmalıdır.

## 4. Eksi bakiye ve limit uyarıları

Nakit/banka hesabındaki gider veya transfer kaynak bakiyeyi eksiye düşürecekse; kredi kartı gideri kullanılabilir limiti aşacaksa işlem öncesinde uyarı gösterilir.

Bu uyarılar yeni kayıt ve düzenleme akışlarında bilinçli olarak yumuşaktır: kullanıcı işlemi iptal edebilir veya eksi bakiyeye/limit aşımına izin vererek devam edebilir. Finansal gerçekliği engellemek yerine kullanıcının kararını görünür kılar. Uyarıyı onaylamak, bakiyeyi ayrıca değiştirmez; işlem yine yalnızca deftere yazılır.

## 5. Kategori ikonları

İkon anahtarları tek bir `CATEGORY_ICON_KEYS` kataloğunda tutulur. Varsayılan kategori eşleştirmeleri `CATEGORY_ICON_DEFAULTS` içindedir; kullanıcının seçtiği `categoryIcons` değeri önceliklidir. Tanınmayan veya geçersiz ikon anahtarı katalog dışı SVG üretmez ve güvenli geri dönüş ikonuna düşer.

Yeni ikon eklenirken katalogla birlikte `sicon()` içindeki SVG karşılığı da eklenmelidir.

## 6. Değişiklik ve test ilkeleri

Finansal değişikliklerde en az şu senaryolar kontrol edilmelidir:

1. Başlangıç bakiyesi + gelir/gider + çift taraflı transfer.
2. Kredi kartı limit artışı/azalışı; mevcut kart borcunun değişmeden kalması.
3. Limit değişikliğinden önceki ve sonraki gün için ayrı tarih sorgusu.
4. Eksi banka bakiyesi ve limit aşan kredi kartı.
5. Hesap oluşturulma tarihinden önceki gün.
6. Eski kart verisinin ilk limit değişiminde açılış değerinin korunması.
7. Kategori ikonunun ekleme ve düzenleme ekranlarında aynı katalogdan seçilmesi.

Uygulama kodunda değişiklik yapıldığında `index.html` ve `public/index.html` aynı içerikte tutulmalıdır. Cloud sync veriyi eşitler; hesap bakiyesini bağımsız bir ikinci defter olarak yönetmez.
