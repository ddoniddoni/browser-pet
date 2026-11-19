import { URL } from 'node:url';
import { createServer } from 'node:http';

const basic = `<!doctype html><html lang="ko"><meta charset="utf-8">
<title>산책 확인</title><style>body{margin:0;min-height:240vh}button{margin:16px}</style>
<h1>산책 확인</h1><button onclick="this.textContent='클릭됨'">눌러 보기</button>
<a href="#destination">페이지 링크</a><label>메모 <input></label><div id="destination"></div>
<iframe title="하위 문서" src="/frame"></iframe></html>`;
const visibility = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>표시 조건</title>
<main id="stage">
<h1>표시 조건 확인</h1><button type="button" id="neutral">편집 끝</button>
<label>짧은 메모 <input></label><label>긴 메모 <textarea></textarea></label>
<div contenteditable="true" role="textbox" aria-label="편집 영역"></div>
<label>읽기 전용 <input readonly></label><div id="component"></div>
<button type="button" id="screen">전체화면 시작</button>
<a href="/basic">다른 문서로</a><button type="button" id="route">주소만 바꾸기</button>
</main><script>
document.getElementById('screen').onclick = () => document.getElementById('stage').requestFullscreen();
document.getElementById('route').onclick = () => history.pushState(null, '', '#section');
const root = document.getElementById('component').attachShadow({mode:'open'});
root.innerHTML='<label>그림자 입력 <input></label>';
</script></html>`;
createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (new URL(req.url, 'http://localhost').pathname === '/visibility') return res.end(visibility);
  if (req.url === '/basic') return res.end(basic);
  if (req.url === '/quirks') return res.end(basic.replace('<!doctype html>', ''));
  if (req.url === '/frame') return res.end('<!doctype html><title>하위 문서</title>');
  res.writeHead(404).end();
}).listen(4187, '127.0.0.1');
