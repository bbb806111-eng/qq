const viewport = document.getElementById('viewport');
const grid = document.getElementById('grid');
const canvas = document.getElementById('canvas');
const links = document.getElementById('links');
const template = document.getElementById('cardTemplate');

const state = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  panning: false,
  startX: 0,
  startY: 0,
  cards: []
};

const typeLabels = {
  shot: '分镜',
  image: '图片',
  video: '视频'
};

function applyView() {
  const transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`;
  grid.style.transform = transform;
  canvas.style.transform = transform;
  links.style.transform = transform;
  drawLinks();
}

function worldPoint(clientX, clientY) {
  const rect = viewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.offsetX) / state.scale,
    y: (clientY - rect.top - state.offsetY) / state.scale
  };
}

function createCard(type, x = 120, y = 120) {
  const node = template.content.firstElementChild.cloneNode(true);
  const id = crypto.randomUUID();
  const card = { id, type, title: `${typeLabels[type]} ${state.cards.length + 1}`, desc: '', x, y, asset: null };

  node.dataset.id = id;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.querySelector('h3').textContent = card.title;
  node.querySelector('.type-badge').textContent = typeLabels[type];

  node.querySelector('h3').addEventListener('input', (e) => {
    card.title = e.target.textContent.trim();
  });

  node.querySelector('.desc').addEventListener('input', (e) => {
    card.desc = e.target.value;
  });

  const assetWrap = node.querySelector('.asset-wrap');
  assetWrap.textContent = '双击可粘贴图片 URL / 视频 URL';
  assetWrap.addEventListener('dblclick', () => {
    const url = prompt('输入资源地址（图片或视频 URL）');
    if (!url) return;
    card.asset = url;
    renderAsset(assetWrap, url);
  });

  enableCardDrag(node, card);
  canvas.appendChild(node);
  state.cards.push(card);
  drawLinks();
}

function renderAsset(container, url) {
  container.innerHTML = '';
  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.webm')) {
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    container.appendChild(video);
    return;
  }
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'asset';
  container.appendChild(img);
}

function enableCardDrag(node, card) {
  let dragging = false;
  let dx = 0;
  let dy = 0;

  node.addEventListener('pointerdown', (e) => {
    if (e.target.closest('textarea') || e.target.closest('.asset-wrap')) return;
    dragging = true;
    node.classList.add('active');
    node.setPointerCapture(e.pointerId);
    dx = e.clientX - card.x * state.scale - state.offsetX;
    dy = e.clientY - card.y * state.scale - state.offsetY;
    e.stopPropagation();
  });

  node.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    card.x = (e.clientX - dx - state.offsetX) / state.scale;
    card.y = (e.clientY - dy - state.offsetY) / state.scale;
    node.style.left = `${card.x}px`;
    node.style.top = `${card.y}px`;
    drawLinks();
  });

  node.addEventListener('pointerup', () => {
    dragging = false;
    node.classList.remove('active');
  });
}

function drawLinks() {
  links.innerHTML = '';
  const ordered = [...state.cards].sort((a, b) => a.x - b.x);
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const from = ordered[i];
    const to = ordered[i + 1];
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const x1 = from.x + 280;
    const y1 = from.y + 60;
    const x2 = to.x;
    const y2 = to.y + 60;
    const cx = (x1 + x2) / 2;
    path.setAttribute('class', 'link');
    path.setAttribute('d', `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`);
    links.appendChild(path);
  }
}

viewport.addEventListener('pointerdown', (e) => {
  state.panning = true;
  viewport.classList.add('dragging');
  state.startX = e.clientX - state.offsetX;
  state.startY = e.clientY - state.offsetY;
});

viewport.addEventListener('pointermove', (e) => {
  if (!state.panning) return;
  state.offsetX = e.clientX - state.startX;
  state.offsetY = e.clientY - state.startY;
  applyView();
});

viewport.addEventListener('pointerup', () => {
  state.panning = false;
  viewport.classList.remove('dragging');
});

viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.92 : 1.08;
  const prev = state.scale;
  const next = Math.min(2.4, Math.max(0.3, prev * factor));
  const pt = worldPoint(e.clientX, e.clientY);
  state.scale = next;
  state.offsetX = e.clientX - pt.x * next - viewport.getBoundingClientRect().left;
  state.offsetY = e.clientY - pt.y * next - viewport.getBoundingClientRect().top;
  applyView();
}, { passive: false });

document.querySelectorAll('[data-add]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const center = worldPoint(window.innerWidth / 2, window.innerHeight / 2);
    createCard(btn.dataset.add, center.x - 140, center.y - 110);
  });
});

document.getElementById('resetView').addEventListener('click', () => {
  state.scale = 1;
  state.offsetX = 0;
  state.offsetY = 0;
  applyView();
});

document.getElementById('exportData').addEventListener('click', () => {
  const payload = JSON.stringify(state.cards, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `storyboard-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importData').addEventListener('change', async (e) => {
  const [file] = e.target.files;
  if (!file) return;
  try {
    const content = await file.text();
    const data = JSON.parse(content);
    if (!Array.isArray(data)) return;
    state.cards = [];
    canvas.innerHTML = '';
    data.forEach((c) => {
      createCard(c.type || 'shot', c.x || 120, c.y || 120);
      const current = state.cards[state.cards.length - 1];
      const node = canvas.lastElementChild;
      current.title = c.title || current.title;
      current.desc = c.desc || '';
      current.asset = c.asset || null;
      node.querySelector('h3').textContent = current.title;
      node.querySelector('.desc').value = current.desc;
      if (current.asset) renderAsset(node.querySelector('.asset-wrap'), current.asset);
    });
    drawLinks();
  } catch {
    alert('导入失败：请确认 JSON 格式。');
  }
});

createCard('shot', 120, 120);
createCard('image', 460, 220);
createCard('video', 800, 130);
applyView();
