const PAGE_SIZE = 100;

const state = {
  rows: [],
  page: 1,
  query: '',
  selected: new Set(),
  result: ''
};

const els = {
  search: document.getElementById('searchInput'),
  clearSearch: document.getElementById('clearSearch'),
  head: document.getElementById('tableHead'),
  body: document.getElementById('tableBody'),
  stats: document.getElementById('tableStats'),
  selectedCount: document.getElementById('selectedCount'),
  result: document.getElementById('resultText'),
  pageLabel: document.getElementById('pageLabel'),
  prev: document.getElementById('prevPage'),
  next: document.getElementById('nextPage'),
  selectPage: document.getElementById('selectPageBtn'),
  clearSelection: document.getElementById('clearSelectionBtn'),
  toast: document.getElementById('toast')
};

const normalize = value => String(value ?? '')
  .toLocaleLowerCase('ru-RU')
  .replace(/ё/g, 'е')
  .trim();

function sheetToRows(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headers = matrix[0] || [];
  return matrix.slice(1)
    .filter(row => row.some(value => String(value).trim() !== ''))
    .map((values, index) => ({
      id: index + 1,
      values,
      code: values[1] ?? '',
      name: values[2] ?? '',
      material: values[3] ?? '',
      headers
    }));
}

async function loadExcel() {
  const response = await fetch('analyses.xlsx');
  if (!response.ok) throw new Error('Не удалось загрузить analyses.xlsx');
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[1]];
  state.rows = sheetToRows(sheet);
  renderCatalog();
}

function searchableText(row) {
  return normalize(row.values.join(' '));
}

function filteredRows() {
  const q = normalize(state.query);
  if (!q) return state.rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return state.rows.filter(row => {
    const haystack = searchableText(row);
    return tokens.every(token => haystack.includes(token));
  });
}

function visibleRows() {
  const rows = filteredRows();
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * PAGE_SIZE;
  return { rows, pageRows: rows.slice(start, start + PAGE_SIZE), totalPages };
}

function makeCell(text) {
  const td = document.createElement('td');
  td.textContent = text === '' || text == null ? '—' : String(text);
  return td;
}

function renderCatalog() {
  const { rows, pageRows, totalPages } = visibleRows();
  els.stats.textContent = `Найдено: ${rows.length.toLocaleString('ru-RU')} · Всего: ${state.rows.length.toLocaleString('ru-RU')}`;
  els.selectedCount.textContent = state.selected.size;
  els.pageLabel.textContent = `Страница ${state.page} из ${totalPages}`;
  els.prev.disabled = state.page <= 1;
  els.next.disabled = state.page >= totalPages;
  els.search.value = state.query;

  els.head.replaceChildren();
  const headerRow = document.createElement('tr');
  const checkHead = document.createElement('th');
  checkHead.className = 'check-cell';
  checkHead.textContent = '✓';
  headerRow.append(checkHead);

  const headers = state.rows[0]?.headers || [];
  headers.slice(1).forEach(label => {
    const th = document.createElement('th');
    th.textContent = label || '—';
    headerRow.append(th);
  });
  els.head.append(headerRow);

  const fragment = document.createDocumentFragment();
  pageRows.forEach(row => {
    const tr = document.createElement('tr');
    if (state.selected.has(row.id)) tr.classList.add('selected');

    const checkTd = document.createElement('td');
    checkTd.className = 'check-cell';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'row-check';
    checkbox.checked = state.selected.has(row.id);
    checkbox.setAttribute('aria-label', `Выбрать ${row.name || row.code}`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selected.add(row.id);
      else state.selected.delete(row.id);
      tr.classList.toggle('selected', checkbox.checked);
      els.selectedCount.textContent = state.selected.size;
    });
    checkTd.append(checkbox);
    tr.append(checkTd);

    row.values.slice(1).forEach(value => tr.append(makeCell(value)));
    fragment.append(tr);
  });

  if (!pageRows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = Math.max(2, (state.rows[0]?.values.length || 1));
    td.className = 'empty';
    td.textContent = 'Ничего не найдено. Попробуйте изменить запрос.';
    tr.append(td);
    fragment.append(tr);
  }

  els.body.replaceChildren(fragment);
  els.result.textContent = state.result || 'Выберите анализы в таблице и нажмите «Создать ГП».';
  els.result.classList.toggle('result-placeholder', !state.result);
}

function selectedRows() {
  return state.rows.filter(row => state.selected.has(row.id));
}

function generateResult() {
  const rows = selectedRows();
  if (!rows.length) {
    state.result = 'Выберите хотя бы один анализ для создания ГП.';
  } else {
    const materials = normalize(rows.map(row => row.material).join(' '));
    const blood = materials.includes('кров');
    const scrape = ['соскоб', 'отделяемое', 'мазок', 'пцр', 'стекло'].some(word => materials.includes(word));

    let text = '';
    if (blood) text += 'VEN - Взятие венозной крови (venous blood sampling)\n';
    if (scrape) {
      text += '1В-ГИН - Взятие цитологического материала, материала для ПЦР диагностики, микробиологических исследований (Cytological material sampling, PCR diagnosis material sampling, microbiology test material sampling)\n';
    }

    text += rows.map(row => `${row.code} - ${row.name} - 1 шт.`).join('\n');
    text += '\nАдрес: ';
    state.result = text;
  }

  els.result.textContent = state.result;
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
  } catch {
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
  state.selected.clear();
  state.result = '';
  renderCatalog();
}

els.search.addEventListener('input', () => {
  state.query = els.search.value;
  state.page = 1;
  renderCatalog();
});

els.clearSearch.addEventListener('click', () => {
  state.query = '';
  state.page = 1;
  renderCatalog();
  els.search.focus();
});

els.prev.addEventListener('click', () => {
  state.page--;
  renderCatalog();
});

els.next.addEventListener('click', () => {
  state.page++;
  renderCatalog();
});

els.selectPage.addEventListener('click', () => {
  visibleRows().pageRows.forEach(row => state.selected.add(row.id));
  renderCatalog();
});

els.clearSelection.addEventListener('click', clearSelection);
document.getElementById('generateBtn').addEventListener('click', generateResult);
document.getElementById('resetBtn').addEventListener('click', clearSelection);
document.getElementById('copyBtn').addEventListener('click', () => {
  if (state.result) copyText(state.result);
  else showToast('Сначала создайте ГП');
});

loadExcel().catch(error => {
  console.error(error);
  els.body.innerHTML = '<tr><td class="empty">Не удалось загрузить данные.</td></tr>';
});