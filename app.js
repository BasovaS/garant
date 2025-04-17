// script.js

async function loadExcel() {
  const response = await fetch('analyses.xlsx');
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  renderTableFromSheet(sheet);
}

function renderTableFromSheet(sheet) {
  const tableContainer = document.getElementById("tableContainer");
  tableContainer.innerHTML = "";
  const table = document.createElement("table");
  table.id = "dataTable";

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const merges = sheet["!merges"] || [];
  const occupied = {};

  for (let R = range.s.r; R <= range.e.r; ++R) {
    const row = document.createElement("tr");

    for (let C = range.s.c; C <= range.e.c; ++C) {
      if (occupied[`${R},${C}`]) continue;

      const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
      const cell = sheet[cellRef];
      const td = document.createElement(R === 0 ? "th" : "td");

      if (C === 0 && R !== 0) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        td.appendChild(checkbox);
      } else {
        td.textContent = cell ? cell.v : "";
      }

      const merge = merges.find(
        (m) =>
          R >= m.s.r &&
          R <= m.e.r &&
          C >= m.s.c &&
          C <= m.e.c
      );

      if (merge) {
        const rowspan = merge.e.r - merge.s.r + 1;
        const colspan = merge.e.c - merge.s.c + 1;
        if (rowspan > 1) td.rowSpan = rowspan;
        if (colspan > 1) td.colSpan = colspan;
        td.classList.add("merged-cell");

        for (let r = merge.s.r; r <= merge.e.r; r++) {
          for (let c = merge.s.c; c <= merge.e.c; c++) {
            if (r === R && c === C) continue;
            occupied[`${r},${c}`] = true;
          }
        }
      }

      row.appendChild(td);
    }

    table.appendChild(row);
  }

  tableContainer.appendChild(table);
}

// Поиск по таблице
const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", () => {
  const filter = searchInput.value.toLowerCase();
  const rows = document.querySelectorAll("#dataTable tr");

  rows.forEach((row, index) => {
    if (index === 0) return;
    const cells = Array.from(row.cells).map((cell) => cell.textContent.toLowerCase());
    const isMatch = cells.some((text) => text.includes(filter));
    row.style.display = isMatch ? "" : "none";
  });
});

// Генерация итога
const generateBtn = document.getElementById("generateBtn");
const resetBtn = document.getElementById("resetBtn");
const copyBtn = document.getElementById("copyBtn");
const resultText = document.getElementById("resultText");

generateBtn.addEventListener("click", () => {
  const table = document.getElementById("dataTable");
  const rows = table.getElementsByTagName("tr");
  let selectedTests = [];
  let result = "";
  let isBlood = false;
  let isScrape = false;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const checkbox = row.cells[0]?.querySelector("input[type='checkbox']");
    if (checkbox && checkbox.checked) {
      const testNumber = row.cells[1]?.textContent.trim() || "";
      const testText = row.cells[2]?.textContent.trim() || "";
      const material = row.cells[3]?.textContent.toLowerCase() || "";

      selectedTests.push(`${testNumber} - ${testText} - 1 шт.`);

      if (material.includes("кров")) isBlood = true;
      if (material.includes("соскоб") || material.includes("отделяемое")) isScrape = true;
    }
  }

  if (isBlood)
    result += "VEN - Взятие венозной крови (venous blood sampling)\n";
  if (isScrape)
    result +=
      "1В-ГИН - Взятие цитологического материала, материала для ПЦР диагностики, микробиологических исследований (Cytological material sampling, PCR diagnosis material sampling, microbiology test material sampling)\n";

  result += selectedTests.join("\n");

  if (selectedTests.length > 0) {
    result += "\nАдрес: ";
  } else {
    result = "Выберите хотя бы один анализ для создания ГП.";
  }

  resultText.textContent = result;
});

resetBtn.addEventListener("click", () => {
  document.querySelectorAll("#dataTable input[type='checkbox']").forEach((cb) => (cb.checked = false));
  resultText.textContent = "";
});

copyBtn.addEventListener("click", () => {
  const text = resultText.textContent.trim();
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.getElementById("toast");
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2000);
  });
});

loadExcel();
