const DATA = {
  invitro: [],
  hemotest: [],
  checkups: []
};

const PAGE_SIZE = 100;

const TAB_CONFIG = {
  invitro: {
    title: 'Инвитро',
    columns: [
      ['code', 'Код', 'code-cell'],
      ['name', 'Название', 'name-cell'],
      ['material', 'Биоматериал', 'material-cell'],
      ['result', 'Результат', 'num-cell'],
      ['days', 'Срок, раб. дн.', 'num-cell'],
      ['price', 'Стоимость, руб.', 'num-cell']
    ]
  },
  hemotest: {
    title: 'Гемотест',
    columns: [
      ['code', 'Код на бланке', 'code-cell'],
      ['name', 'Название услуги для ГП', 'name-cell'],
      ['days', 'Срок выполнения', 'num-cell'],
      ['price', 'ИНД-10524, руб.', 'num-cell'],
      ['newPrice', 'Новая цена, руб.', 'num-cell']
    ]
  }
};

const state = {
  active: 'invitro',
  page: { invitro: 1, hemotest: 1 },
  query: { invitro: '', hemotest: '' },
  selected: { invitro: new Set(), hemotest: new Set() },
  results: { invitro: '', hemotest: '' },
  loaded: false
};

const els = {
  catalogView: document.getElementById('catalogView'),
  checkupsView: document.getElementById('checkupsView'),
  search: document.getElementById('searchInput'),
  clearSearch: document.getElementById('clearSearch'),
  head: document.getElementById('tableHead'),
  body: document.getElementById('tableBody'),
  title: document.getElementById('tableTitle'),
  stats: document.getElementById('tableStats'),
  selectedCount: document.getElementById('selectedCount'),
  result: document.getElementById('resultText'),
  pageLabel: document.getElementById('pageLabel'),
  prev: document.getElementById('prevPage'),
  next: document.getElementById('nextPage'),
  selectPage: document.getElementById('selectPageBtn'),
  clearSelection: document.getElementById('clearSelectionBtn'),
  checkupSearch: document.getElementById('checkupSearch'),
  checkupGrid: document.getElementById('checkupGrid'),
  toast: document.getElementById('toast')
};

const normalize = value => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase('ru-RU')
  .replace(/ё/g, 'е')
  .trim();
const formatValue = value => value === '' || value == null ? '—' : String(value);
const rowKey = (tab, row) => `${tab}:${row.id}`;

function parseInvitroSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  return rows.slice(1)
    .filter(row => row.some(value => String(value).trim() !== ''))
    .map((row, index) => ({
      id: index + 1,
      code: row[1] ?? '',
      name: row[2] ?? '',
      material: row[3] ?? '',
      result: row[4] ?? '',
      days: row[5] ?? '',
      price: row[6] ?? ''
    }));
}

function parseHemotestSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  return rows.slice(1)
    .filter(row => row.some(value => String(value).trim() !== ''))
    .map((row, index) => ({
      id: index + 1,
      code: row[1] ?? '',
      name: row[2] ?? '',
      days: row[3] ?? '',
      price: row[4] ?? '',
      newPrice: row[5] ?? ''
    }));
}

function parseCheckupsSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  return rows.slice(1)
    .filter(row => row.some(value => String(value).trim() !== ''))
    .map((row, index) => ({
      id: index + 1,
      name: row[0] ?? '',
      composition: row[1] ?? '',
      standard: row[2] ?? '',
      invitro: row[3] ?? ''
    }));
}

async function loadData() {
  const response = await fetch('analyses.xlsx', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Не удалось загрузить analyses.xlsx: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  if (workbook.SheetNames.length < 4) {
    throw new Error('В analyses.xlsx ожидается минимум 4 листа');
  }

  DATA.invitro = parseInvitroSheet(workbook.Sheets[workbook.SheetNames[1]]);
  DATA.hemotest = parseHemotestSheet(workbook.Sheets[workbook.SheetNames[2]]);
  DATA.checkups = parseCheckupsSheet(workbook.Sheets[workbook.SheetNames[3]]);

  state.loaded = true;
}

function searchableText(row) {
  return normalize(Object.values(row).join(' '));
}

function filteredRows(tab = state.active) {
  const q = normalize(state.query[tab]);
  if (!q) return DATA[tab];
  const tokens = q.split(/\s+/).filter(Boolean);
  return DATA[tab].filter(row => {
    const haystack = searchableText(row);
    return tokens.every(token => haystack.includes(token));
  });
}

function visibleRows() {
  const rows = filteredRows();
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.page[state.active] = Math.min(state.page[state.active], totalPages);
  const start = (state.page[state.active] - 1) * PAGE_SIZE;
  return { rows, pageRows: rows.slice(start, start + PAGE_SIZE), totalPages };
}

function makeCell(text, className = '') {
  const td = document.createElement('td');
  td.textContent = formatValue(text);
  if (className) td.className = className;
  return td;
}

function renderCatalog() {
  if (!state.loaded) return;

  const tab = state.active;
  const config = TAB_CONFIG[tab];
  const selection = state.selected[tab];
  const { rows, pageRows, totalPages } = visibleRows();
  const page = state.page[tab];

  els.title.textContent = config.title;
  els.search.value = state.query[tab];
  els.search.placeholder = tab === 'hemotest'
    ? 'Поиск по коду или названию…'
    : 'Поиск по коду, названию или биоматериалу…';
  els.stats.textContent = `Найдено: ${rows.length.toLocaleString('ru-RU')} · Всего: ${DATA[tab].length.toLocaleString('ru-RU')}`;
  els.selectedCount.textContent = selection.size;
  els.pageLabel.textContent = `Страница ${page} из ${totalPages}`;
  els.prev.disabled = page <= 1;
  els.next.disabled = page >= totalPages;

  els.head.replaceChildren();
  const headerRow = document.createElement('tr');
  const checkHead = document.createElement('th');
  checkHead.className = 'check-cell';
  checkHead.textContent = '✓';
  headerRow.append(checkHead);

  for (const [, label] of config.columns) {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.append(th);
  }
  els.head.append(headerRow);

  const fragment = document.createDocumentFragment();
  for (const row of pageRows) {
    const tr = document.createElement('tr');
    const key = rowKey(tab, row);
    if (selection.has(key)) tr.classList.add('selected');

    const checkTd = document.createElement('td');
    checkTd.className = 'check-cell';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'row-check';
    checkbox.checked = selection.has(key);
    checkbox.setAttribute('aria-label', `Выбрать ${formatValue(row.name)}`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selection.add(key);
      else selection.delete(key);
      tr.classList.toggle('selected', checkbox.checked);
      els.selectedCount.textContent = selection.size;
      updateResult();
    });
    checkTd.append(checkbox);
    tr.append(checkTd);

    for (const [field, , className] of config.columns) {
      tr.append(makeCell(row[field], className));
    }
    fragment.append(tr);
  }

  if (!pageRows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = config.columns.length + 1;
    td.className = 'empty';
    td.textContent = 'Ничего не найдено. Попробуйте изменить запрос.';
    tr.append(td);
    fragment.append(tr);
  }

  els.body.replaceChildren(fragment);

  updateResult();
}

function selectedRows(tab) {
  const set = state.selected[tab];
  return DATA[tab].filter(row => set.has(rowKey(tab, row)));
}

function requiresGynSampling(row) {
  const normalizedCode = normalize(row.code).replace(/\s+/g, '');

  // Точные исключения из прайса: эти анализы всегда требуют 1В-ГИН.
  const forcedGynSamplingCodes = new Set(['517', '518', '519']);
  if (forcedGynSamplingCodes.has(normalizedCode)) {
    return true;
  }

  const text = normalize([
    row.code,
    row.name,
    row.material,
    row.result
  ].filter(Boolean).join(' '));

  // Явные признаки цитологического исследования.
  const cytologyMarkers = [
    'цитолог',
    'цитограмм',
    'онкоцитолог',
    'жидкостн',
    'папаниколау',
    'pap test',
    'pap-test',
    'pap smear',
    'цервикальн',
    'эндоцервик',
    'экзоцервик',
    'шейки матки',
    'цервикального канала'
  ];

  if (cytologyMarkers.some(marker => text.includes(marker))) {
    return true;
  }

  // Явные формулировки материала, для которых требуется отдельное взятие.
  const samplingMaterialMarkers = [
    'соскоб эпителиальных клеток',
    'урогенитальн',
    'вагинальн',
    'цервикальн',
    'уретральн',
    'отделяемое половых органов',
    'мазок',
    'стекло'
  ];

  if (samplingMaterialMarkers.some(marker => text.includes(marker))) {
    return true;
  }

  // Для ПЦР учитываем не само слово «ПЦР», а сочетание с материалом,
  // который действительно нужно брать отдельно. Это снижает ложные срабатывания
  // на ПЦР-исследования крови и других уже полученных образцов.
  const pcrMarkers = [
    'пцр',
    'определение днк',
    'определение рнк',
    'dna',
    'rna'
  ];

  const pcrSamplingSites = [
    'соскоб',
    'мазок',
    'урогенитальн',
    'вагинальн',
    'цервикальн',
    'уретральн',
    'ротоглот',
    'слизист',
    'конъюнктив',
    'отделяемое'
  ];

  return pcrMarkers.some(marker => text.includes(marker))
    && pcrSamplingSites.some(marker => text.includes(marker));
}

function buildResult(tab = state.active) {
  const rows = selectedRows(tab);
  let text = '';

  if (!rows.length) {
    text = tab === 'hemotest'
      ? 'Не выбраны анализы.'
      : 'Выберите хотя бы один анализ для создания ГП.';
  } else if (tab === 'hemotest') {
    text = 'ID 417621 «Лучи Здоровье»\n';
    text += rows.map(row => `${formatValue(row.code)} - ${formatValue(row.name)} - 1 шт.`).join('\n');
    text += '\nАдрес: ';
  } else {
    const blood = rows.some(row =>
      normalize([row.name, row.material].filter(Boolean).join(' ')).includes('кров')
    );

    const gynSampling = rows.some(requiresGynSampling);

    if (blood) {
      text += 'VEN - Взятие венозной крови (venous blood sampling)\n';
    }
    if (gynSampling) {
      text += '1В-ГИН - Взятие цитологического материала, материала для ПЦР диагностики, микробиологических исследований (Cytological material sampling, PCR diagnosis material sampling, microbiology test material sampling)\n';
    }

    text += rows.map(row => `${formatValue(row.code)} - ${formatValue(row.name)} - 1 шт.`).join('\n');
    text += '\nАдрес: ';
  }

  return text;
}

function updateResult() {
  const tab = state.active;
  const hasSelection = state.selected[tab].size > 0;
  if (!hasSelection) {
    state.results[tab] = '';
    els.result.textContent = 'Выберите анализы в таблице.';
    els.result.classList.add('result-placeholder');
    return;
  }

  const text = buildResult(tab);
  state.results[tab] = text;
  els.result.textContent = text;
  els.result.classList.remove('result-placeholder');
}

async function copyText(text) {
  if (!text) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (!ok) throw new Error('copy failed');
    }

    showToast('Скопировано');
    return true;
  } catch (error) {
    showToast('Не удалось скопировать');
    return false;
  }
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function clearSelection() {
  state.selected[state.active].clear();
  state.results[state.active] = '';
  renderCatalog();
}

function switchTab(tab, updateHash = true) {
  document.querySelectorAll('.tab').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });

  if (updateHash) history.replaceState(null, '', `#${tab}`);

  if (tab === 'checkups') {
    els.catalogView.classList.add('hidden');
    els.checkupsView.classList.add('active');
    renderCheckups();
    return;
  }

  state.active = tab;
  els.checkupsView.classList.remove('active');
  els.catalogView.classList.remove('hidden');
  renderCatalog();
}

function createCopyBlock(title, text) {
  const block = document.createElement('section');
  block.className = 'copy-block';

  const heading = document.createElement('h3');
  heading.textContent = title;

  const pre = document.createElement('pre');
  pre.textContent = text || '—';

  const button = document.createElement('button');
  button.className = 'copy-cell';
  button.type = 'button';
  button.textContent = '⧉';
  button.title = `Скопировать: ${title}`;
  button.setAttribute('aria-label', `Скопировать ${title}`);
  button.addEventListener('click', () => copyText(text));

  block.append(heading, button, pre);
  return block;
}

function renderCheckups() {
  const q = normalize(els.checkupSearch.value);
  const tokens = q.split(/\s+/).filter(Boolean);

  const rows = DATA.checkups.filter(row => {
    const haystack = searchableText(row);
    return tokens.every(token => haystack.includes(token));
  });

  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    const card = document.createElement('article');
    card.className = 'panel checkup-card';

    const title = document.createElement('h2');
    title.className = 'checkup-name';
    title.textContent = row.name || 'Без названия';

    const columns = document.createElement('div');
    columns.className = 'checkup-columns';
    columns.append(
      createCopyBlock('Состав', row.composition),
      createCopyBlock('Стандартное ГП', row.standard),
      createCopyBlock('Код Инвитро', row.invitro)
    );

    card.append(title, columns);
    fragment.append(card);
  }

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'panel empty';
    empty.textContent = 'Чекапы по запросу не найдены.';
    fragment.append(empty);
  }

  els.checkupGrid.replaceChildren(fragment);
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });

  els.search.addEventListener('input', () => {
    state.query[state.active] = els.search.value;
    state.page[state.active] = 1;
    renderCatalog();
  });

  els.clearSearch.addEventListener('click', () => {
    state.query[state.active] = '';
    state.page[state.active] = 1;
    renderCatalog();
    els.search.focus();
  });

  els.prev.addEventListener('click', () => {
    state.page[state.active]--;
    renderCatalog();
  });

  els.next.addEventListener('click', () => {
    state.page[state.active]++;
    renderCatalog();
  });

  els.selectPage.addEventListener('click', () => {
    const selection = state.selected[state.active];
    for (const row of visibleRows().pageRows) {
      selection.add(rowKey(state.active, row));
    }
    renderCatalog();
  });

  els.clearSelection.addEventListener('click', clearSelection);
  document.getElementById('resetBtn').addEventListener('click', clearSelection);

  document.getElementById('copyBtn').addEventListener('click', () => {
    const text = state.results[state.active] || '';
    if (text) copyText(text);
    else showToast('Сначала выберите анализ');
  });

  els.checkupSearch.addEventListener('input', renderCheckups);
}

function resolveInitialTab() {
  const hash = location.hash.replace('#', '');
  return ['invitro', 'hemotest', 'checkups'].includes(hash) ? hash : 'invitro';
}

async function init() {
  bindEvents();

  try {
    await loadData();
    const initialTab = resolveInitialTab();
    switchTab(initialTab, false);
  } catch (error) {
    console.error(error);
    els.result.textContent = 'Не удалось загрузить analyses.xlsx.';
    els.result.classList.remove('result-placeholder');
    els.body.innerHTML = '<tr><td class="empty">Не удалось загрузить данные из analyses.xlsx.</td></tr>';
    showToast('Ошибка загрузки данных');
  }
}

init();