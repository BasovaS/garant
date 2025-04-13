window.onload = function() {
    // Загружаем файл .xlsx
    fetch('analyses.xlsx')
      .then(response => {
        if (!response.ok) {
          throw new Error('Ошибка загрузки файла');
        }
        return response.arrayBuffer();
      })
      .then(data => {
        try {
          // Чтение и обработка файла
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
          // Преобразуем таблицу в JSON с сохранением всех ячеек
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }); // defval: "" для пустых ячеек
  
          // Отображение таблицы с флажками
          displayTable(jsonData);
        } catch (error) {
          console.error('Ошибка обработки файла .xlsx:', error);
        }
      })
      .catch(error => {
        console.error('Ошибка загрузки файла:', error);
      });
  };
  
  // Функция для отображения данных в таблице
  function displayTable(data) {
    const table = document.getElementById('dataTable');
    table.innerHTML = ''; // Очистить таблицу
  
    if (data && data.length > 0) {
      // Создание заголовков таблицы
      const headerRow = document.createElement('tr');
      data[0].forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
      });
      table.appendChild(headerRow);
  
      // Заполнение данных таблицы
      data.slice(1).forEach(row => {
        const tr = document.createElement('tr');
        row.forEach((cell, index) => {
          const td = document.createElement('td');
          if (index === 0) {
            // Если это первый столбец, создаём флажок
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = row[0]; // присваиваем флажку значение (например, код теста или номер строки)
            td.appendChild(checkbox);
          } else {
            // Если это не первый столбец, просто отображаем данные
            td.textContent = cell;
          }
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });
    } else {
      console.error('Данные таблицы не загружены или пусты.');
    }
  }
  
  // Генерация итогового текста
  document.getElementById('generateBtn').addEventListener('click', function() {
    const table = document.getElementById('dataTable');
    const rows = table.getElementsByTagName('tr');
    let selectedTests = [];
    let resultText = '';
    let isBlood = false;  // Флаг для проверки "кров"
    let isScrape = false; // Флаг для проверки "соскоб" или "отделяемое"
  
    // Сбор выбранных анализов
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const checkboxCell = row.cells[0]; // Получаем ячейку с чекбоксом
  
      // Если ячейка с чекбоксом существует и внутри неё есть элемент input[type="checkbox"]
      if (checkboxCell && checkboxCell.querySelector) {
        const checkbox = checkboxCell.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
          const testNumber = row.cells[1].textContent; // Столбец с номером теста (№ теста)
          const testText = row.cells[2].textContent; // Столбец с текстом (Текст)
          const sampleMaterial = row.cells[3].textContent.toLowerCase(); // Столбец с биоматериалом (Е)
  
          // Формируем строку "№ теста - Текст - 1 шт"
          selectedTests.push(`${testNumber} - ${testText} - 1 шт.`);
  
          // Проверка на наличие "кров" в биоматериале
          if (sampleMaterial.includes('кров')) {
            isBlood = true;
          }
  
          // Проверка на наличие "соскоб" или "отделяемое" в биоматериале
          if (sampleMaterial.includes('соскоб') || sampleMaterial.includes('отделяемое')) {
            isScrape = true;
          }
        }
      }
    }
  
    // Логика для добавления текста в начало
    if (isBlood && isScrape) {
      resultText = "VEN - Взятие венозной крови (venous blood sampling)\n1В-ГИН - Взятие цитологического материала, материала для ПЦР диагностики, микробиологических исследований (Cytological material sampling, PCR diagnosis material sampling, microbiology test material sampling)\n";
    } else if (isBlood) {
      resultText = "VEN - Взятие венозной крови (venous blood sampling)\n";
    } else if (isScrape) {
      resultText = "1В-ГИН - Взятие цитологического материала, материала для ПЦР диагностики, микробиологических исследований (Cytological material sampling, PCR diagnosis material sampling, microbiology test material sampling)\n";
    }
  
    // Формирование итогового текста
    selectedTests.forEach(test => {
      resultText += test + "\n";
    });
  
    // Добавление "Адрес:"
    resultText += "Адрес: ";
  
    // Если результат пуст, показываем сообщение
    if (resultText.trim() === '') {
      resultText = 'Выберите хотя бы один анализ для создания ГП.';
    }
  
    // Вывод результата в блок "Итог"
    document.getElementById('resultText').textContent = resultText;
  });
  
  document.getElementById('resetBtn').addEventListener('click', function() {
    // Сброс текста результата
    document.getElementById('resultText').textContent = '';
  
    // Снимаем все флажки в таблице
    const table = document.getElementById('dataTable');
    const rows = table.getElementsByTagName('tr');
    
    for (let i = 1; i < rows.length; i++) {
      const checkboxCell = rows[i].cells[0];
      if (checkboxCell && checkboxCell.querySelector) {
        const checkbox = checkboxCell.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = false; // Снимаем флажок
        }
      }
    }
  });
  