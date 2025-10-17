// Ждем, пока вся страница загрузится
document.addEventListener("DOMContentLoaded", function() {
  
  // Находим элемент-контейнер для шапки
  const headerPlaceholder = document.getElementById("header-placeholder");
  
  // Если такой элемент есть на странице
  if (headerPlaceholder) {
    // Загружаем содержимое файла header.html
    fetch("header.html")
      .then(response => response.text())
      .then(data => {
        // Вставляем загруженный HTML в наш контейнер
        headerPlaceholder.innerHTML = data;
      });
  }

});