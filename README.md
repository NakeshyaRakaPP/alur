# ALUR — Puzzle Merakit Sistem

Game puzzle merakit alur sistem di papan isometrik 2.5D: pasang mesin proses di grid bebas, sambungkan dengan belt yang digambar menyeret (rutenya dicari otomatis), tekan RUN, dan lihat token mengalir serta berubah dari INPUT sampai OUTPUT persis seperti target. **18 level dalam 4 chapter** — FILTER, CHANGE, SPLIT (3 port keluar, routing bisa diatur pemain), BUFFER, SORT, sampai MERGE dan sistem penuh. Setiap level punya anggaran rail; menyelesaikan level membuka **mode Expert**-nya (rail lebih ramping, inventaris terbatas, sel rintangan, mesin terkunci).

## Menjalankan

```bash
npm install
npm run dev        # mode pengembangan (semua chapter terbuka)
```

## Build

```bash
npm run build      # versi penuh -> dist/
npm run build:demo # versi demo (flag VITE_DEMO=1): hanya Chapter 1 yang dapat
                   # dimainkan; chapter lain terkunci dan menyelesaikan
                   # Chapter 1 menampilkan layar gerbang versi penuh.
npm run preview    # pratinjau hasil build
```

Satu codebase, dua keluaran: build demo untuk portofolio, build penuh untuk aplikasi.

## Verifikasi level

```bash
npm run verify
```

Script ini menjalankan solusi tersimpan setiap level lewat engine simulasi yang sama dengan yang dipakai aplikasi, dan memastikan outputnya cocok dengan target (termasuk aturan paket TAHAN dan jebakan level Final).

## Struktur

- `src/engine.ts` — engine simulasi token + penilaian (verdict) + metrik (Node, Ruang, Langkah) dan bintang.
- `src/levels/` — data level per chapter; level adalah data, bukan hardcode di komponen. Setiap level menyimpan solusi referensinya.
- `src/components/` — layar pilih level (`HomeScreen`), layar game (`GameScreen`), dan papan SVG (`Board`).
- `src/progress.ts` — bintang dan rekor terbaik per level di `localStorage` (kunci `alur.progress.v1`; mode Expert terpisah di `alur.progress.expert.v1`; preferensi suara di `alur-sfx-muted`). Progres murni lokal per browser & per domain — tanpa akun, tanpa server, tanpa sinkronisasi antar perangkat.

## Deploy

Hasil `npm run build` adalah situs statis di `dist/`.

- **Vercel** (disarankan): import repo, preset Vite, build command `npm run build`, output `dist`. Path aset absolut dari root domain (`/art/...`), jadi deploy di root domain langsung jalan.
- **GitHub Pages** (project site `username.github.io/alur/`): perlu `base: '/alur/'` di `vite.config.ts` — jangan deploy ke subpath tanpa mengubah base.
- `scripts/verify-levels.ts` — pengujian headless untuk seluruh level.
