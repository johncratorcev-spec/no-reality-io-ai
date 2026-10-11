#!/usr/bin/env python3
"""Сборка data/posts.csv: 1 старый рабочий пост + 5 новых из Threads."""

import re


def read_url(path: str) -> str:
    raw = open(path).read()
    m = re.search(r'https://[^"\s]+', raw)
    return m.group(0).strip()


old_video = "https://scontent-hkg1-2.cdninstagram.com/o1/v/t16/f2/m84/AQNCVShcgJJl9YbkDDuu5B4Ke_SYzSXvrRG_VylrTfbNKJvGwvMCNwHo2yCbhevt1Ioyu5B963DsRcKCiggZZ5f4LQI9nJh519HgnGw.mp4?_nc_cat=102&_nc_sid=5e9851&_nc_ht=scontent-hkg1-2.cdninstagram.com&_nc_ohc=ZcJOfKZ5pkcQ7kNvwGYRAYp&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0FST1VTRUxfSVRFTS5DMy4xMjgwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTc5ODUyNTg1MzcxMTI0NDMsImFzc2V0X2FnZV9kYXlzIjoxLCJ2aV91c2VjYXNlX2lkIjoxMDE2NCwiZHVyYXRpb25fcyI6OCwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=2b45798c571f1d0d&_nc_vs=HBksFQIYTGlnX2JhY2tmaWxsX3RpbWVsaW5lX3ZvZC83NzQ4MjQ2MUNCM0E5NkIyODI4RUYxNTFFMjcxN0RCN192aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0ZFNDY0OUU5QTFEQzU3MjZDOTcyRUZCOEMyOUJGRjkzX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb2zeKk6t_yPxUCKAJDMywXQCCj1wo9cKQYEmRhc2hfYmFzZWxpbmVfMV92MREAde4HZeieAQA&_nc_gid=jAUsgqYX1R6Qy-abM2aQPg&_nc_zt=28&_nc_ss=7a22e&oh=00_AQKO3vwaK_btnUFUAedmR1keNftJqMxzJOE3QYih-lxmbA&oe=6AA2E7F6"

rows = [
    # url, title, author, utm, video
    ("https://www.threads.com/share/BAWygmiJjY/",
     "Позорище какое качество выдает ChatGPT image 2... и в видео это заметно",
     "@stanislavstarchenko", "rRAfCpxz", old_video),
    ("https://www.threads.com/share/BAaF-XGP8N/",
     "", "@unknown", "y7KQ3mNc", ""),  # пост недоступен в Threads — ждём замену
    ("https://www.threads.com/share/_phUmdERK/",
     "Video posted by Have_it",
     "@hafidansori", "J9tQLqnH", read_url("/tmp/post1_url.txt")),
    ("https://www.threads.com/share/BAQh9Z2CjQ/",
     'Comment "prompt" (Seedance 25, chatgpt astra)',
     "@digitalarnab", "EwNwx4oG", read_url("/tmp/post3_url.txt")),
    ("https://www.threads.com/share/BAbm6AMMyV/",
     "Sci-fi cinematic prompt for Seedance 2.5",
     "@sebastien", "63GLQu_Z", read_url("/tmp/post4_url.txt")),
    ("https://www.threads.com/share/BAWa2nBQhN/",
     "вирусится новый ИИ тренд на 🍋 — кому туториал?",
     "@lilyawayy", "Cd5kn7GN", read_url("/tmp/post6_url.txt")),
    ("https://www.threads.com/share/BARUQawSaS/",
     "She is not ready. Come another day. Built with Seedance 2.5 inside CapCut",
     "@theailadder", "Wi-5HoqV", read_url("/tmp/post5_url.txt")),
]


def esc(s: str) -> str:
    if any(c in s for c in ',"\n'):
        return '"' + s.replace('"', '""') + '"'
    return s


lines = ["url,title,author,utm_code,video_url"]
for url, title, author, utm, video in rows:
    lines.append(f"{url},{esc(title)},{author},{utm},{video}")

open("/home/z/my-project/data/posts.csv", "w").write("\n".join(lines) + "\n")
print("CSV written:", len(lines) - 1, "posts")
