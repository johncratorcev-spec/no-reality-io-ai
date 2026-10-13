#!/usr/bin/env bash
# v22 - вставка 8 раффлов из 9 Threads-ссылок (share/BAXhh5JpjK @curlyriii
# заблокирован Threads: 'This content isn't available' - в вставку не попал).
# Метки куратора (v16-методика):
#   real = @elliiiiiiissss (фото реального SMM-инфлюенсера, 5 слайдов одной
#          съёмки) + @ethanduran (реальная съёмка: McLaren у Cafe Bureau NYC
#          + бокс-зал);
#   synth = @ai_ajeossi (#aifilm в подписи), @selena_moondust (AI-fantasy
#           доспехи), @vagabondiary (Last kiss - AI-тренд кометы),
#           @thebatmanai, @glennhasabeard (Minimax locally), @baran_robin_
#           (#seedance).
set -e
cd "$(dirname "$0")/.."

node scripts/add_raffle_clip.mjs \
  --source "https://www.threads.com/share/BAgATO_vRh/" \
  --video "https://scontent-hkg4-1.cdninstagram.com/v/t51.82787-15/843278745_18124264915936130_4798758881115723898_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=NDAwNjU3MDQ2ODI1MTg3MjY1Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuNDAzMi5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_R13S-8hvvIQ7kNvwEBYfqX&_nc_oc=Adr-MCuzmhAe_qXOyiFiFf6shhGSPw6h2TMUQBKc9Oq9-eRn3e5tAqtrYnCdUCva5s8&_nc_zt=23&_nc_ht=scontent-hkg4-1.cdninstagram.com&_nc_gid=dMsOaoCImz2rEUIFeNH5SA&_nc_ss=7f289&oh=00_AQP45B1V7LRuPO4Aq1uviy6L_C1j35uFeLqJwxMDYRE8Gg&oe=6AD412BE" \
  --photos "https://scontent-hkg4-1.cdninstagram.com/v/t51.82787-15/843278745_18124264915936130_4798758881115723898_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=NDAwNjU3MDQ2ODI1MTg3MjY1Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuNDAzMi5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_R13S-8hvvIQ7kNvwEBYfqX&_nc_oc=Adr-MCuzmhAe_qXOyiFiFf6shhGSPw6h2TMUQBKc9Oq9-eRn3e5tAqtrYnCdUCva5s8&_nc_zt=23&_nc_ht=scontent-hkg4-1.cdninstagram.com&_nc_gid=dMsOaoCImz2rEUIFeNH5SA&_nc_ss=7f289&oh=00_AQP45B1V7LRuPO4Aq1uviy6L_C1j35uFeLqJwxMDYRE8Gg&oe=6AD412BE,https://scontent-hkg4-2.cdninstagram.com/v/t51.82787-15/843761976_18124264936936130_2604356772030052824_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=NDAwNjU3MDQ5MDY4MzE3ODQ0MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjY2OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mdku11QZPxQQ7kNvwHab6yn&_nc_oc=AdolWGBHtFcRns1MpfV_3RF6OXz5yzgbQKz6eUW09_1k0fPkAyxo-MU9AEyl8InTNlA&_nc_zt=23&_nc_ht=scontent-hkg4-2.cdninstagram.com&_nc_gid=dMsOaoCImz2rEUIFeNH5SA&_nc_ss=7f289&oh=00_AQMx8H4bZK1ekyzHdixw-9oJUBp-BAmOoR_qHwrB2Go0Hw&oe=6AD404DF,https://scontent-hkg4-2.cdninstagram.com/v/t51.82787-15/841166456_18124224952936130_9031038699194471805_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=NDAwNjM5ODEzODI2NzUwMTk0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuNDAzMi5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=WhGDXtmDY1UQ7kNvwF2euUa&_nc_oc=AdpVU0sUggISqxFkShYAzk3fEyQY0OsMT-uelbfeWU1aF5a-ChLvql6Pd2dRVG-QjDQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-hkg4-2.cdninstagram.com&_nc_gid=nrPAxM3vPqFMdLDNjoK1LQ&_nc_ss=7a22e&oh=00_AQO5Hj7_bWVON4x8RWaxIkswh0-hMPHlyiQiLUCzB5yZzg&oe=6AD43681,https://scontent-hkg1-2.cdninstagram.com/v/t51.82787-15/840975694_18124224976936130_4613222557770795805_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=NDAwNjM5ODE2NzYxOTIzOTc2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMzAyNC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=j4OwgKM0xg0Q7kNvwEqNgdJ&_nc_oc=Adprn9Go19FkQi5tvLEZ8eN5CjoHCfnhB8GQwgkvnRnMvz1Sy19Im8OY5fz1K6gKED4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-hkg1-2.cdninstagram.com&_nc_gid=nrPAxM3vPqFMdLDNjoK1LQ&_nc_ss=7a22e&oh=00_AQOmGEVLxw-2yAmgODcZ854vD6ciO668WKsFkTzchDjpPQ&oe=6AD42A8B,https://scontent-hkg1-2.cdninstagram.com/v/t51.82787-15/840498807_18124253038936130_3082499745994178164_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=NDAwNjUwODIwNjE1Nzk1Mjc5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjY2OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=lVSJe4YOyTQQ7kNvwED1r42&_nc_oc=Adq9L_pEE9g1dwbNwv5F742iGQY3qEnBphgBqSzTsaXvy2m5x8sIn2YMxg6vR0Zgwe0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-hkg1-2.cdninstagram.com&_nc_gid=nrPAxM3vPqFMdLDNjoK1LQ&_nc_ss=7a22e&oh=00_AQN8kbfyO3M8ZVbG55hfT8fz1ln8od5wAmO34P6na5n-Ww&oe=6AD40AD7" \
  --label real \
  --badge raffle-05 \
  --caption "кому нужен красивый смм?" \
  --author @elliiiiiiissss \
  --featured-days 7

node scripts/add_raffle_clip.mjs \
  --source "https://www.threads.com/share/BAu3KK4_L9/" \
  --video "https://scontent-hkg1-1.cdninstagram.com/o1/v/t2/f2/m86/AQNdYjym90vfju9JsoW4eOjBSxXIo82AjdTwZ5kwsM_J4I4wddW06tMCeSlsEnqQosJxhtyKtgVTO0oZlF32bMYj4IiD1Px5YQTAoV8.mp4?_nc_cat=101&_nc_sid=5e9851&_nc_ht=scontent-hkg1-1.cdninstagram.com&_nc_ohc=V-qA0gOCmvgQ7kNvwGVSx-Z&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uRkVFRC5DMy4xMjc2LmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MjI5MTkyOTI3MTM0ODAyMywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoxMiwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=fca8455ab424e99c&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9CRjQ0NjkxQzVFQkQ0RDMzOTQyMDlFOTc0QUU4QkI2NF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzMyNzRCNEI5NThDMjRFRjdCMjk0M0ZDQ0JEMkY5MTRDX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACburI3h65-SCBUCKAJDMywXQCibItDlYEIYEmRhc2hfYmFzZWxpbmVfMV92MREAdeoHZeadAQA&_nc_gid=KBaw5HRH4rjq2dglQk7adw&_nc_ss=7f289&_nc_zt=28&oh=00_AQMURiid3EL2XubrUSq5czvJdeqzQ8gm6sFXpMpYoRLDWA&oe=6AD0183E" \
  --label real \
  --badge raffle-06 \
  --caption "" \
  --author @ethanduran \
  --featured-days 7

node scripts/add_raffle_clip.mjs \
  --source "https://www.threads.com/share/BBoN1LcYAl/" \
  --video "https://scontent-hkg1-2.cdninstagram.com/o1/v/t2/f2/m86/AQN0Yn9NmO2U0cx2-Yjz5Fn3agGdCtK1FXqxaYX_U8IQv20PhFlbHGxm_xG_LkC8y9LyzNllPgcjq2D3AHnBSaNvY2ePqoo3YR2UoQc.mp4?_nc_cat=103&_nc_sid=5e9851&_nc_ht=scontent-hkg1-2.cdninstagram.com&_nc_ohc=mNQheXzdjpAQ7kNvwFg7dd9&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uRkVFRC5DMy43MjAuZGFzaF9iYXNlbGluZV8xX3YxIiwieHB2X2Fzc2V0X2lkIjo5NzA2Njc5NDIxMjkwMDQsImFzc2V0X2FnZV9kYXlzIjowLCJ2aV91c2VjYXNlX2lkIjoxMDA5OSwiZHVyYXRpb25fcyI6NDYsInVybGdlbl9zb3VyY2UiOiJ3d3cifQ%3D%3D&ccb=17-1&vs=856bc22461724fdb&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC85RDhEMTFCQzE3MzE0QzcyOENBNkE5QzA2RkI0RkNEQl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0U4QUNCOTEwMkExRDREMjY5NDJBRkVCNjJDNjc3NEFEX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbYtZXep7S5AxUCKAJDMywXQEczMzMzMzMYEmRhc2hfYmFzZWxpbmVfMV92MREAdeoHZeadAQA&_nc_gid=wj-8jk-qlUpORINKJEGicA&_nc_ss=7f289&_nc_zt=28&oh=00_AQNuEtowJ4g-HDUUrgxTVswsIsSuzkp-ZXonCb0g1rchMw&oe=6AD01C50" \
  --label synth \
  --badge raffle-07 \
  --caption "Waste Sorting 分別回収 — it wasn't me the bag was afraid of." \
  --author @ai_ajeossi \
  --featured-days 7

node scripts/add_raffle_clip.mjs \
  --source "https://www.threads.com/share/BAWfah2971/" \
  --video "https://scontent-hkg4-1.cdninstagram.com/o1/v/t16/f2/m84/AQPlOAlQcehdO--g6kx2b0YhucQ321CS0ZhF1LC0CMjlo1JghiZ3b4pxJOus12KlUco6upOlBOYceH3oYWXYE5otfeBPZbA7NhFSK18.mp4?_nc_cat=110&_nc_sid=5e9851&_nc_ht=scontent-hkg4-1.cdninstagram.com&_nc_ohc=exFGgYFD-H0Q7kNvwF5OFMt&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uRkVFRC5DMy43MjAuZGFzaF9iYXNlbGluZV8xX3YxIiwieHB2X2Fzc2V0X2lkIjoxMDc0ODM3NTkyMTIzMjI1LCJhc3NldF9hZ2VfZGF5cyI6MCwidmlfdXNlY2FzZV9pZCI6MTA4MjcsImR1cmF0aW9uX3MiOjEwLCJ1cmxnZW5fc291cmNlIjoid3d3In0%3D&ccb=17-1&vs=4167a4b0ae38e4b5&_nc_vs=HBksFQIYTGlnX2JhY2tmaWxsX3RpbWVsaW5lX3ZvZC83Qzk4QzgwMTEyRjA0MjVGQUE4NjIwRTZENzAwN0EwMF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzRGMEREMjI1MkU3NzQ5OUI5NEQ1RUI5MEY4OTJERjcxX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACaynfWN5OPoAxUCKAJDMywXQCTul41P3zsYEmRhc2hfYmFzZWxpbmVfMV92MREAdeoHZZapAQA&_nc_gid=_A9IA2RRpAlWP9cjaVYVqQ&_nc_ss=7f289&_nc_zt=28&oh=00_AQPQi_zjuTMl7NKmaPyaHxeeXWk1H8o-RWBxfTn8i5E-6A&oe=6AD01F42" \
  --label synth \
  --badge raffle-08 \
  --caption "🥹 🏰 ⚔️ Armor : artisanya_leather_craft #castle #medieval #darkfantasy #knight #armor" \
  --author @selena_moondust \
  --featured-days 7

node scripts/add_raffle_clip.mjs \
  --source "https://www.threads.com/share/BAUB2A0peE/" \
  --video "https://scontent-hkg1-2.cdninstagram.com/o1/v/t16/f2/m84/AQPyHE59CM1iQ9-fuSU9AWj4xjQiXke8pBoVmiHrLNXP4FEPM-RnNEVXiIacf2fER8DgkmWEg1pO_SKfLeSZXqLERUSm26teVuHPtpc.mp4?_nc_cat=104&_nc_sid=5e9851&_nc_ht=scontent-hkg1-2.cdninstagram.com&_nc_ohc=PbxfXwx2-nAQ7kNvwHd3m8P&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0FST1VTRUxfSVRFTS5DMy43MjAuZGFzaF9iYXNlbGluZV8xX3YxIiwieHB2X2Fzc2V0X2lkIjoxODQ1MTM5NDkyMzEyMTk2OSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMTQ2LCJkdXJhdGlvbl9zIjo1LCJ1cmxnZW5fc291cmNlIjoid3d3In0%3D&ccb=17-1&vs=3d50babaecf43924&_nc_vs=HBkcFQIYTGlnX2JhY2tmaWxsX3RpbWVsaW5lX3ZvZC8wMjM1QkVCRjMzRjk0OTg4QUU2QUE3MkUyNzlENEFENF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAKAAYABsCiAd1c2Vfb2lsATEScHJvZ3Jlc3NpdmVfcmVjaXBlATEVAAAm4rSGgMXcxkEVAigCQzMsF0AUKfvnbItEGBJkYXNoX2Jhc2VsaW5lXzFfdjERAHXuB2XEngEA&_nc_gid=erXUxScTLrv6BzHIZYV5tg&_nc_ss=7a22e&_nc_zt=28&oh=00_AQO0faAj_cw06bKr1s7MfE9aGdmlTWQhSahvDpfesvXQMA&oe=6AD03E48" \
  --label synth \
  --badge raffle-09 \
  --caption "Last kiss" \
  --author @vagabondiary \
  --featured-days 7

node scripts/add_raffle_clip.mjs \
  --source "https://www.threads.com/share/BAOv9fmMBa/" \
  --video "https://scontent-hkg1-1.cdninstagram.com/o1/v/t16/f2/m84/AQNP2pxnIz7Mifzql9l-y1l7gEEXkwnZaQhS37v9kmOO_eCetCgmIzrOE0UQxMG17MO06NFzR6UlC_MGRnYDGoyw6vo1rMNo97Fso1Q.mp4?_nc_cat=105&_nc_sid=5e9851&_nc_ht=scontent-hkg1-1.cdninstagram.com&_nc_ohc=XnwvDHydzzkQ7kNvwFv_m-l&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uRkVFRC5DMy4xMjgwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTgxMjQzNDc1ODY4MTE3NTQsImFzc2V0X2FnZV9kYXlzIjowLCJ2aV91c2VjYXNlX2lkIjoxMDE2NCwiZHVyYXRpb25fcyI6MTAsInVybGdlbl9zb3VyY2UiOiJ3d3cifQ%3D%3D&ccb=17-1&vs=5ecb33de977c0d3e&_nc_vs=HBksFQIYTGlnX2JhY2tmaWxsX3RpbWVsaW5lX3ZvZC83QTQwRTM5RDEzQTk0MkU4ODczNDM3Q0Q3N0Q1NkEwNF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0NBQUY1M0ZCODhDMzRDRjJCNTFERTJFRDRFOUU0N0QyX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbU3ZS78P-xQBUCKAJDMywXQCQAAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdeoHZeieAQA&_nc_gid=rEtrPp_d5Y3cljUtWnXvNA&_nc_ss=7f289&_nc_zt=28&oh=00_AQMGrO1yp3PQFPS0962gztjyfdSwoHRssbYBTEGNtIgVsg&oe=6AD02F1B" \
  --label synth \
  --badge raffle-10 \
  --caption "" \
  --author @thebatmanai \
  --featured-days 7

node scripts/add_raffle_clip.mjs \
  --source "https://www.threads.com/share/BAE5napSO3/" \
  --video "https://scontent-hkg4-1.cdninstagram.com/o1/v/t16/f2/m84/AQP711zPh2gySTiWQ0IIm2KQCb7XehxHutkV8TziQLxT2n1mKFuUb3duSh-13khOJiZTSqxsHplp6UgWO95J0DabnuIyGFRYCeNfdg8.mp4?_nc_cat=108&_nc_sid=5e9851&_nc_ht=scontent-hkg4-1.cdninstagram.com&_nc_ohc=NLOujz2jeBcQ7kNvwEGTt3-&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uRkVFRC5DMy42NDAuZGFzaF9iYXNlbGluZV8zX3YxIiwieHB2X2Fzc2V0X2lkIjoxNzkwMDQ2NjE2NTYwNjkyNSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMTY0LCJkdXJhdGlvbl9zIjoxNSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=c9c30a75c23d4dd7&_nc_vs=HBksFQIYTGlnX2JhY2tmaWxsX3RpbWVsaW5lX3ZvZC84NjI4NkFEREI1RDI0REI5OEEzMUFBNzExQkI2QjNBMl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0JGNTM3RTdFODE5RTQxRTc4QjkxMTg3OTBDOUE0NDEwX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACaaqOvxoZjMPxUCKAJDMywXQC4hysCDEm8YEmRhc2hfYmFzZWxpbmVfM192MREAdeoHZeieAQA&_nc_gid=eE-TDaE30SkYYiLzoSQSiQ&_nc_ss=7f289&_nc_zt=28&oh=00_AQNv-3c7Wl9Mel4KaYvMmk9GRh49oJIdLnlP5cIFxLdxUw&oe=6AD01E20" \
  --label synth \
  --badge raffle-11 \
  --caption "" \
  --author @glennhasabeard \
  --featured-days 7

node scripts/add_raffle_clip.mjs \
  --source "https://www.threads.com/share/BBWx_CXVdx/" \
  --video "https://scontent-hkg1-1.cdninstagram.com/o1/v/t2/f2/m86/AQOsBsSimZxZPhPJPTkb_jYTjq9JqkNQM8CP2yWY_yMf4E0ht1wDC6paxwgGlSUdUez-0lDDW266wXO8pOJeztUfGxdUAlNAWldUvzU.mp4?_nc_cat=105&_nc_sid=5e9851&_nc_ht=scontent-hkg1-1.cdninstagram.com&_nc_ohc=m_UHSTVe_YEQ7kNvwF2j6De&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uRkVFRC5DMy43MjAuZGFzaF9iYXNlbGluZV8xX3YxIiwieHB2X2Fzc2V0X2lkIjoxNDAyOTM3NjUxOTkyNTkyLCJhc3NldF9hZ2VfZGF5cyI6MCwidmlfdXNlY2FzZV9pZCI6MTAwOTksImR1cmF0aW9uX3MiOjMwLCJ1cmxnZW5fc291cmNlIjoid3d3In0%3D&ccb=17-1&vs=41e80979b06cb582&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC84NkE4ODlCQjc5RkU0N0RCQUUxMDU5ODhEMUU0NjY1RV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzZCMDdBQzMwMTM5QTQyMTc4NUU4QTlCQTUwRkJGRkU1X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACag4JyG3P39BBUCKAJDMywXQD4KfvnbItEYEmRhc2hfYmFzZWxpbmVfMV92MREAdeoHZeadAQA&_nc_gid=AphrwnTmO7HtfUKF5YcfnQ&_nc_ss=7f289&_nc_zt=28&oh=00_AQOnv19g1fy0ejGLR9iHskd_a7IT5ZyaEptEZj-bnTY53A&oe=6AD021C6" \
  --label synth \
  --badge raffle-12 \
  --caption "" \
  --author @baran_robin_ \
  --featured-days 7
