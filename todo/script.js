const inputBox = document.querySelector(".inputBox");
const todoList = document.querySelector(".todoList");
const button = document.querySelector(".button");

function NewTask() {
  if (inputBox.value === "") {
    return;
  }

  const task = document.createElement("li")
  task.innerHTML = `
    <input type="checkbox" class="checkbox">
    <label>${inputBox.value}</label>
    <button class="trashcan">🗑</button>
  `;

  const trashcan = task.querySelector(".trashcan");
  trashcan.addEventListener("click", function() {
    task.remove();
  });

  const checkbox = task.querySelector(".checkbox");
  checkbox.addEventListener("change", function() {
    if (checkbox.checked) {
      task.style.textDecoration = "line-through";
      task.style.color = "#999";
      todoList.append(task);
    } else {
      task.style.textDecoration = "none";
      task.style.color = "";
      todoList.prepend(task);
    }
  });

  todoList.append(task);
  inputBox.value = "";
}

inputBox.addEventListener("keyup", function(e) {
  if (e.key === "Enter") {
    NewTask();
  }
});

button.addEventListener("click", NewTask);