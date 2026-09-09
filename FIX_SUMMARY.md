# Fix Summary - Bug Corrections

## 1️⃣ Bug #1: Logout Redirect ke Domain Lama `stovitmart.app`

### Problem
Ketika logout, aplikasi mengarahkan ke domain lama (`stovitmart.app`) alih-alih domain baru (`stovitmart.my.id`).

### Root Cause
NextAuth v5 tidak memiliki konfigurasi `redirect callback` yang eksplisit untuk memaksa semua redirect tetap di base URL yang benar. Default behavior NextAuth bisa mengikuti header request atau fallback ke domain yang tersimpan di session/cookie.

### Solution

#### File: `src/lib/auth.ts`
- ✅ Tambahkan `trustHost: true` untuk mempercayai header reverse proxy
- ✅ Tambahkan callback `redirect` yang memaksa semua Auth.js redirects tetap di baseUrl
- ✅ Callback memeriksa apakah URL tujuan sama origin dengan baseUrl, jika ya gunakan, jika tidak selalu pakai baseUrl

```typescript
async redirect({ url, baseUrl }) {
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(baseUrl);
    
    if (urlObj.origin === baseObj.origin) {
      return url;
    }
  } catch {
    // url bukan valid URL, fallback ke baseUrl
  }
  
  return baseUrl;
},
```

#### File: `.env`, `.env.example`, `.env.production.example`
- ✅ Pastikan `AUTH_URL` diatur sesuai domain production
- ✅ Contoh: `AUTH_URL="http://localhost:3000"` untuk dev, `AUTH_URL="https://domain-kamu.com"` untuk prod

### Testing Steps
1. Login sebagai admin atau customer
2. Click logout button
3. Verify redirect ke: `https://stovitmart.my.id/masuk` (bukan domain lama)

---

## 2️⃣ Bug #2: Image Upload Tidak Bisa Disimpan

### Problem
Tombol "Unggah" gambar produk tidak berfungsi dengan baik. Preview gambar tidak muncul dan URL `/uploads/xxx.webp` tidak save dengan benar.

### Root Causes Identified
1. **Syntax Error**: Line 8-9 di `product-form.tsx` corruption:
   ```typescript
   import { import { useEffect } from "react";
   zodResolver } from "@hookform/resolvers/zod";
   ```
2. **Unnecessary State**: `uploadedImageUrls` state yang tidak reliable
3. **Unused Effect Hook**: Sync effect untuk tracking uploaded URLs yang tidak efektif

### Solutions Applied

#### File: `src/app/admin/produk/product-form.tsx`

1. **Fix Import Syntax** (line 3-9):
   ```typescript
   // BEFORE (broken):
   import { import { useEffect } from "react";
   zodResolver } from "@hookform/resolvers/zod";
   
   // AFTER (fixed):
   import { useState, useEffect } from "react";
   import { zodResolver } from "@hookform/resolvers/zod";
   import { useFieldArray, useForm, useWatch, Controller } from "react-hook-form";
   ```

2. **Removed Unnecessary Workaround**:
   - ❌ Hapus state `uploadedImageUrls` 
   - ❌ Hapus `useEffect` sync untuk tracking uploaded images
   
   Ini hanya workaround yang tidak reliable. Solusi sebenarnya adalah fix syntax error dan biarkan React Hook Form handle form data dengan normal.

3. **Preserved Core Logic**: Semua fungsi penting tetap ada:
   - ✅ `handleNameChange()` - auto-generate slug
   - ✅ `regenerateSlug()` - manual regenerate slug
   - ✅ `setPrimaryImage()` - set primary image
   - ✅ `onSubmit()` - submit form dengan toast feedback

4. **Maintained Clean Code Structure**:
   - Variables: `price`, `images` watched correctly
   - `unitItems` dictionary preserved for unit dropdown

### How Image Upload Works Now

1. User click "Unggah" button → opens file input
2. Selected file sent to `/api/upload` endpoint
3. API validates, re-encodes as WebP, saves to `public/uploads/`
4. Returns URL format: `/uploads/uuid.webp`
5. `onUploaded()` callback sets this URL to form field
6. Schema accepts both absolute URLs and relative paths (`/uploads/*`)
7. Preview displays via `<Image unoptimized src={url} />`
8. Save persist URL ke database

### Why This Approach is Better

✅ **No Base64 overhead** - images stored as files, not in DB  
✅ **Nginx caching** - `/uploads/` served directly by nginx  
✅ **Database performance** - only text URLs in DB, not binary  
✅ **CDN friendly** - easy to add CDN later for uploads folder  

### Testing Steps
1. Go to `/admin/produk/baru` or edit existing product
2. Click "Unggah" button next to image URL input
3. Select image file (JPG/PNG/WebP/AVIF, max 5MB)
4. Verify successful toast: "Gambar berhasil diunggah."
5. Verify image appears in preview box
6. Click "Jadikan utama" if needed
7. Save product
8. Refresh page → verify images still display
9. Check storefront → verify products show images correctly

---

## Environment Variables Required

### Development (.env)
```bash
AUTH_URL="http://localhost:3000"
APP_URL="http://localhost:3000"
AUTH_TRUST_HOST=true
```

### Production (.env.production)
```bash
AUTH_URL="https://stovitmart.my.id"
APP_URL="https://stovitmart.my.id"
AUTH_TRUST_HOST=true
```

---

## Deployment Notes

After deploying these fixes:

1. **Restart Next.js container** to pick up new auth config
2. **Clear browser cache** to remove old domain cookies
3. **Verify nginx serves /uploads/** - check `/var/www/uploads/` volume mounted correctly

---

## Technical Changes Summary

| File | Lines Changed | Type of Change |
|------|--------------|----------------|
| `src/lib/auth.ts` | ~30 lines added | NextAuth redirect callback + trustHost |
| `src/app/admin/produk/product-form.tsx` | ~15 lines fixed | Syntax fix + cleanup unnecessary code |
| `.env` | 2 lines added | AUTH_URL configuration |
| `.env.example` | 1 line added | Documentation update |
| `.env.production.example` | 10 lines added | Improved AUTH_URL documentation |

Total: ~60 lines across 5 files

---

## What NOT to Change

These are working correctly:
- ✅ `/api/upload` endpoint validation
- ✅ Database schema for ProductImage
- ✅ Nginx configuration for `/uploads/` alias
- ✅ Docker volume mounts for uploads folder
- ✅ ProductFormSchema validation rules

---

Generated: $(date +"%Y-%m-%d %H:%M:%S")
