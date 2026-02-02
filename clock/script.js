const clock = document.querySelector(".clock");
const time = document.querySelector(".time");
const subject = document.querySelector(".subject");

const events = [
  // 2月3日
  { date: "2026-02-03", start: "08:00", end: "10:00", name: "数学" },
  { date: "2026-02-03", start: "10:30", end: "11:45", name: "历史" },
  { date: "2026-02-03", start: "14:20", end: "15:35", name: "政治" },
  { date: "2026-02-03", start: "16:05", end: "17:20", name: "地理" },

  // 2月4日
  { date: "2026-02-04", start: "08:00", end: "09:15", name: "物理" },
];

function EnsureFormat(x) {
  if (x < 10) {
    return "0" + x;
  }
  return x;
}

function ParseTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00`);
}

function Clock() {
  let now = new Date();
  let hour = now.getHours();
  let minute = EnsureFormat(now.getMinutes());
  let second = EnsureFormat(now.getSeconds());
  time.innerHTML = `${hour}:${minute}:${second}`;

  const currentExam = events.find(e => {
    const start = ParseTime(e.date, e.start);
    const end = ParseTime(e.date, e.end);
    return start <= now && now <= end;
  });

  if (currentExam) {
    subject.innerHTML = `${currentExam.name} ${currentExam.start} ~ ${currentExam.end}`;
  } else {
    subject.innerHTML = "";
  }

  setTimeout(Clock, 250);
}

function SetRandomBackgroundImage() {
  const images = [
    "images/Sorasaki\\ Hina.png",
    "images/Sunaookami\\ Shiroko.jpg"
  ];
  const index = Math.floor(Math.random() * images.length);
  clock.setAttribute("style", `background-image: url(${images[index]});`);
}

SetRandomBackgroundImage();
Clock();