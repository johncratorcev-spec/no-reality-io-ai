import re, sys, json

def analyze(path):
    h = open(path, encoding='utf-8', errors='ignore').read()
    vids = re.findall(r'https://scontent[^"\\\s]+\.mp4[^"\\\s]*', h)
    print(f'== {path}: {len(h)} bytes, videos: {len(vids)}')
    for u in vids[:3]:
        print('   vid:', u[:110])
    m = re.search(r'property="og:title" content="([^"]*)"', h)
    print('   og:title:', m.group(1)[:120] if m else None)
    m = re.search(r'property="og:description" content="([^"]*)"', h)
    print('   og:descr:', (m.group(1)[:120] if m else None))
    print('   usernames:', sorted(set(re.findall(r'/@([A-Za-z0-9_.]+)/post/', h)))[:5])
    print('   invalid_post:', 'invalid_post' in h)
    return vids

if __name__ == '__main__':
    for p in sys.argv[1:]:
        analyze(p)
