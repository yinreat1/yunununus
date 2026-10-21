# ProPOS Lisans Merkezi — yayınlama

Bu sürüm, `ldlvjixemyrexirzdyio` Supabase projesine göre düzenlenmiştir. Lisans doğrulamasında SHA-256 özeti kullanılır; yöneticinin tam anahtarı görebilmesi için yeni lisans anahtarı ayrıca Edge Function tarafında AES-GCM ile şifrelenerek saklanır. Düz metin anahtar tarayıcıya sadece yönetici doğrulamasından sonra gösterilir.

## 1. Supabase veritabanı

`supabase/migrations/20261017100000_license_center_admin_schema.sql` ve `supabase/migrations/20261021090000_license_key_ciphertext.sql` migration dosyalarını hedef Supabase projesinde çalıştırın. İkinci migration `license_key_ciphertext` alanını ekler; mevcut lisansların hash değerlerini değiştirmez. Bu migration mevcut `propos_licenses` ve `propos_license_devices` tablolarını silmez; müşteri tablosu ekler, eski müşteri adlarını taşır ve tarayıcıdan doğrudan tablo erişimini kapatır.

## 2. Edge Function

`supabase/functions/admin-license-management/index.ts` dosyasını `admin-license-management` adıyla deploy edin; `verify_jwt=true` kalmalıdır. `supabase/functions/verify-propos-license/index.ts` dosyasını da `verify-propos-license` adıyla deploy edin (`verify_jwt=false`); sürüm, eski büyük/küçük harfe duyarlı hash'lerle geriye dönük uyumluluk kontrolünü içerir. Function, giriş yapan kullanıcının `app_metadata.role` değeri `admin` değilse yönetim işlemlerini reddeder.

## 3. Yönetici hesabı

Supabase Dashboard → Authentication → Users bölümünden yönetici kullanıcı oluşturun. Kullanıcı detaylarında **App Metadata** alanını şu JSON ile ayarlayın:

```json
{"role":"admin"}
```

Bu rolü User Metadata içine değil, App Metadata içine koyun. Public sign-up kullanmıyorsanız açık bırakmayın.

## 4. Vercel

Bu projeyi GitHub'a yükleyip Vercel'de içe aktarın. Environment Variables bölümünde şu değerleri tanımlayın:

- `VITE_SUPABASE_URL` = `https://ldlvjixemyrexirzdyio.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = Supabase Dashboard → API Keys bölümündeki publishable (`sb_publishable_...`) anahtar

Ardından yeniden deploy edin. `service_role` anahtarını asla Vercel'in `VITE_` değişkeni olarak eklemeyin ve GitHub'a yüklemeyin.

## 5. Yerelde test

```bash
npm ci
cp .env.example .env
# .env içindeki VITE_SUPABASE_ANON_KEY değerini publishable anahtarla değiştirin
npm run typecheck
npm run build
```

## Önemli

- Önceki sürümde oluşturulmuş lisansların gerçek anahtarı yalnızca hash olarak tutulduysa geri çıkarılamaz. Paneldeki **Yeni anahtar üret** işlemi eski anahtarı geçersiz kılar; müşteriye yeni anahtarın verilmesi gerekir.
- Yeni lisanslar şifreli anahtar alanı ile tam olarak gösterilir ve kopyalanabilir. Anahtarın yenilenmesi, açık onay gerektirir.
- Bu proje frontend'de yalnızca publishable/anon anahtar kullanır. Yönetim işlemleri JWT ve `app_metadata.role=admin` kontrolü yapan Edge Function üzerinden geçer.
