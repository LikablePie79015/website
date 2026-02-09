async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = [...new Uint8Array(hashBuffer)];
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const authentication = document.querySelector(".authentication");
const input = document.querySelector(".psw");
const button = document.querySelector(".btn");
const diary = document.querySelector(".diary");

function CheckPassword() {
  const promise = sha256(input.value);
  promise.then((result) => {
    if (result == "9f56b1d66573c5e2f1285506f342b133c02e8c374f3db301fdebdf785211b959") {
      authentication.setAttribute("style", "display: none;");
      diary.setAttribute("style", "display: block;");
    } else {
      alert("密码错误！");
    }
  });
}

button.addEventListener("click", function() { CheckPassword() });
input.addEventListener("keyup", function(e) {
  if (e.key == "Enter") { CheckPassword(); }
});
diary.setAttribute("style", "display: none");