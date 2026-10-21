# ProPOS Lisans Merkezi — Düzeltme Notları

## Yapılan düzeltmeler

- Lisans anahtarı, yalnızca maskeli `license_key_hint` alanından gösterilmek yerine, yeni kayıtlar için sunucuda AES-GCM ile şifrelenen `license_key_ciphertext` alanından okunur. Lisans doğrulamasında SHA-256 özeti kullanılmaya devam eder.
- Lisans detayı ve liste artık erişilebilir olduğu sürece tam anahtarı gösterir. Kopyalama işlemi tamamlanan tam metni panoya yazar ve hata durumunu kullanıcıya bildirir.
- Eski lisansın tam anahtarı geçmişte yalnızca SHA-256 olarak kaydedilmişse geriye dönük çıkarılamaz. Detay ekranındaki alanla belirli bir yeni anahtar (örneğin `PROPOS-JPM9-CLCN-RTVR-BNZT`) belirleyebilir veya rastgele yeni anahtar üretebilirsin. Bu işlem mevcut anahtarı geçersiz kılar; onay istemeden çalışmaz.
- Yönetim API'sinin hata mesajı panelde gösterilir; böylece 403, yönetici rolü veya oturum sorunları genel bir hatanın arkasında gizlenmez.
- Liste verisi tek API çağrısıyla yüklenir; gereksiz çift listeleme kaldırılır.
- Yeni lisans anahtarları kriptografik rastgelelik kullanan kod üretimiyle hazırlanır. Doğrulama Edge Function'ı geçmişte oluşturulmuş büyük/küçük harfe duyarlı hash'lerle uyumludur.

## Üretimde yapılan Supabase değişiklikleri

- `public.propos_licenses.license_key_ciphertext` alanı eklendi.
- `admin-license-management` Edge Function sürüm 3'e deploy edildi; `verify_jwt=true` ve yönetici rolü kontrolü korunuyor.
- `verify-propos-license` Edge Function sürüm 2'ye deploy edildi; `verify_jwt=false` olarak kaldı ve eski hash'ler için uyumluluk kontrolü eklendi.
- Yönetici e-posta hesabının `auth.users.raw_app_meta_data.role` değeri `admin` olarak doğrulandı.

## Yayına alma

1. Bu klasörün içeriğini bağlı GitHub deposunun köküne yükle/commit et.
2. Vercel projesi aynı GitHub deposunu izliyorsa commit sonrasında otomatik dağıtımı bekle.
3. Vercel ortam değişkenleri `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` mevcut olmalı. Service role anahtarını istemci ortam değişkeni olarak ekleme.
4. Siteye çıkış yapıp tekrar giriş yap. Yönetim ekranında listeyi aç; mevcut eski lisansı seçip anahtarı yenilerken doğru anahtarı kullan. Anahtar değişimi mevcut anahtarı geçersiz kılar.

## Test notu

Kaynak dosyalarda TypeScript/TSX sözdizimi kontrolü ve geçici tip bildirimleriyle statik kontrol yapıldı. Bu ortamda npm paket deposunun DNS çözümlemesi başarısız olduğundan `npm ci`, tam `npm run typecheck` ve `npm run build` çalıştırılamadı; bu nedenle tam üretim derlemesi burada doğrulanmış sayılmıyor. Vercel build logu yayına alma öncesinde kontrol edilmeli.
