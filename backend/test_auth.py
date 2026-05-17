import urllib.request
import urllib.error

req = urllib.request.Request('http://127.0.0.1:8000/api/wallets/me', headers={'Authorization': 'Bearer test'})
try:
    print(urllib.request.urlopen(req).read())
except urllib.error.HTTPError as e:
    print('ERROR:', e.code, e.read().decode())
