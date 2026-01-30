const showtime = document.querySelector(".showtime");

function EnsureFormat(x) {
  if (x < 10) {
    return "0" + x;
  }
  return x;
}

function Clock() {
  let today = new Date();
  let hour = today.getHours();
  let minute = EnsureFormat(today.getMinutes());
  let second = EnsureFormat(today.getSeconds());
  showtime.innerHTML = `${hour}:${minute}:${second}`;
  setTimeout(Clock, 500);
}

document.addEventListener("load", Clock());