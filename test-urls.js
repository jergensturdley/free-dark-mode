function extractHostname(input) {
  let urlStr = input.trim();
  if (!urlStr) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(urlStr)) {
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) return null;
  } else if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = 'https://' + urlStr;
  }
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    if (!hostname || hostname === 'extensions') return null;
    if (!hostname.includes('.') && hostname !== 'localhost') return null;
    return hostname;
  } catch (e) { return null; }
}

const urls = ['localhost:3000', 'example.com:8080', 'chrome://extensions', 'ftp://example.com', 'about:blank', 'http://test.com', 'https://test.com/path', 'file:///tmp/foo'];
urls.forEach(u => console.log(u, '=>', extractHostname(u)));
