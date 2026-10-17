# ProPOS Lisans Merkezi — yayınlama

Bu sürüm, `ldlvjixemyrexirzdyio` Supabase projesine göre düzenlenmiştir. Lisans anahtarları veritabanında düz metin olarak değil SHA-256 özeti olarak saklanır. Oluşturulan yeni anahtar sadece oluşturma ekranında görünür; güvenli bir yere kopyalayın.

## 1. Supabase veritabanı

`supabase/migrations/20261017100000_license_center_admin_schema.sql` migration dosyasını hedef Supabase projesinde çalıştırın. Bu migration mevcut `propos_licenses` ve `propos_license_devices` tablolarını silmez; müşteri tablosu ekler, eski müşteri adlarını taşır ve tarayıcıdan doğrudan tablo erişimini kapatır.

## 2. Edge Function

`supabase/functions/admin-license-management/index.ts` dosyasını `admin-license-management` adıyla deploy edin. JWT doğrulaması açık kalmalıdır. Function, giriş yapan kullanıcının `app_metadata.role` değeri `admin` değilse yönetim işlemlerini reddeder.

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

- Önceden oluşturulmuş lisansların gerçek anahtarları yalnızca hash olarak saklandığı için yeniden gösterilemez. Eski anahtarlar lisans sahibinin elindeyse doğrulanmaya devam eder.
- Her yeni lisans oluşturulduğunda anahtarı hemen kopyalayın. Liste görünümünde yalnızca maskelenmiş anahtar görünür.
- Bu proje frontend'de yalnızca publishable/anon anahtar kullanır. Yönetim işlemleri JWT ve `app_metadata.role=admin` kontrolü yapan Edge Function üzerinden geçer.
