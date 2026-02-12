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
  if (!input.value) return ;

  const promise = sha256(input.value);
  promise.then(async (pwd) => {
    const res = await fetch("https://api.2095607220.workers.dev", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({ password: pwd })
    });

    if (res.status === 200) {
      const html = await res.text();
      diary.innerHTML = html;
      authentication.setAttribute("style", "display: none;");
      diary.setAttribute("style", "display: block;");
    } else {
      alert("密码错误！");
      input.value = "";
    }
  });
}


button.addEventListener("click", function() { CheckPassword() });
input.addEventListener("keyup", function(e) {
  if (e.key == "Enter") { CheckPassword(); }
});