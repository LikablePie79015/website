document.addEventListener("DOMContentLoaded", function() {
  Decimal.set({
    toExpPos: 1000,
    precision: 1000
  });
});

const nowInput = document.querySelector(".nowInput");
const cacheInput = document.querySelector(".cacheInput")

const buttonNum1 = document.querySelector(".num-1");
const buttonNum2 = document.querySelector(".num-2");
const buttonNum3 = document.querySelector(".num-3");
const buttonNum4 = document.querySelector(".num-4");
const buttonNum5 = document.querySelector(".num-5");
const buttonNum6 = document.querySelector(".num-6");
const buttonNum7 = document.querySelector(".num-7");
const buttonNum8 = document.querySelector(".num-8");
const buttonNum9 = document.querySelector(".num-9");
const buttonNum0 = document.querySelector(".num-0");
const buttonDot = document.querySelector(".dot");

const buttonC = document.querySelector(".C");
const buttonCE = document.querySelector(".CE");
const buttonBackspace = document.querySelector(".backspace");

let cache = [];
let nowNum = new Decimal(0);

/**
 * 添加一个字符，添加 0~9
 * @param {String} digit - 要添加的数字
 */
function AddDigit(digit) {
  if (nowInput.value === "0") nowInput.value = "";
  nowInput.value += digit;
  nowNum = new Decimal(nowInput.value);
}

/**
 * 当前是够有小数点
 */
let hasPoint = false;
/**
 * 添加小数点
 */
function AddPoint() {
  if (hasPoint) { return; }
  hasPoint = true;
  nowInput.value += ".";
}

/**
 * 清除所有
 */
function ClearAll() {
  cache = [];
  nowNum = new Decimal(0);
  nowInput.value = "0";
  cacheInput.value = "";
}

/**
 * 仅清除当前数字
 */
function ClearNow() {
  nowInput.value = "0";
  nowNum = new Decimal(0);
}

/**
 * 退格
 */
function Backspace() {
  let temp = nowInput.value;
  temp = temp.substring(0, temp.length - 1);
  if (temp === "") temp = "0";
  nowInput.value = temp;
  nowNum = new Decimal(temp);
}

buttonNum0.addEventListener("click", function() { AddDigit("0"); });
buttonNum1.addEventListener("click", function() { AddDigit("1"); });
buttonNum2.addEventListener("click", function() { AddDigit("2"); });
buttonNum3.addEventListener("click", function() { AddDigit("3"); });
buttonNum4.addEventListener("click", function() { AddDigit("4"); });
buttonNum5.addEventListener("click", function() { AddDigit("5"); });
buttonNum6.addEventListener("click", function() { AddDigit("6"); });
buttonNum7.addEventListener("click", function() { AddDigit("7"); });
buttonNum8.addEventListener("click", function() { AddDigit("8"); });
buttonNum9.addEventListener("click", function() { AddDigit("9"); });
buttonDot.addEventListener("click", function() { AddPoint(); });

buttonC.addEventListener("click", function() { ClearAll(); });
buttonCE.addEventListener("click", function() { ClearNow(); });
buttonBackspace.addEventListener("click", function() { Backspace(); });

document.addEventListener("keydown", function(e) {
  if (e.key == "0") { AddDigit("0"); return; }
  if (e.key == "1") { AddDigit("1"); return; }
  if (e.key == "2") { AddDigit("2"); return; }
  if (e.key == "3") { AddDigit("3"); return; }
  if (e.key == "4") { AddDigit("4"); return; }
  if (e.key == "5") { AddDigit("5"); return; }
  if (e.key == "6") { AddDigit("6"); return; }
  if (e.key == "7") { AddDigit("7"); return; }
  if (e.key == "8") { AddDigit("8"); return; }
  if (e.key == "9") { AddDigit("9"); return; }
  if (e.key == "c") { ClearNow(); return; }
  if (e.key == "C") { ClearAll(); return; }
  if (e.key == "Backspace") { Backspace(); return; }
  if (e.key == ".") { AddPoint(); return; }
});