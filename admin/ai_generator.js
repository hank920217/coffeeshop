import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const adminEmails = ["moonlightcafe.com@gmail.com"];

// 執行身分檢查
onAuthStateChanged(auth, (user) => {
  if (user && adminEmails.includes(user.email)) {
    // 已登入且是管理員
    console.log("驗證通過");
    document.body.style.display = "block";
  } else {
    // 未登入或身分不符
    if (user) {
      alert("此帳號無管理權限");
    }
    // 直接強制跳轉回登入首頁
    window.location.href = "index.html";
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const btnGen = document.getElementById("btn-gen");

  btnGen.addEventListener("click", async () => {
    // 取得輸入欄位元素
    const nameEl = document.getElementById("aiName");
    const priceEl = document.getElementById("aiPrice");
    const keysEl = document.getElementById("aiKeys");

    // 取得 UI 反饋元素
    const spinner = document.querySelector(".loading-spinner");
    const btnText = document.querySelector(".btn-text");

    if (!nameEl.value) return alert("請輸入商品名稱");

    // UI 狀態切換：進入載入狀態
    if (spinner) spinner.style.display = "inline-block";
    if (btnText) btnText.textContent = "AI 生成中請稍後...";
    btnGen.disabled = true;
    if (resultArea) resultArea.style.display = "none";

    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `你是一位專業的台灣質感咖啡廳品牌行銷專家。請根據提供的資訊生成一個 JSON 物件。 JSON 格式必須嚴格遵守：{ "title": "...", "detail": "...", "price": 數字 }。

                            關於 "detail" 欄位，請務必按照以下結構撰寫，並確保內容超過 250 字，口吻溫柔、文青且具儀式感：
                            [開頭感性文案]：請根據title的商品名稱寫一段感性詩句作為開場（不須標題），字數介於30到40字，且整段文字必須使用「粗斜體」格式（例如：<b><i>這是一段午後的溫柔語錄...</i></b>）。

                            【風味層次】：生動描述風味的前調、中調與餘韻（如：微酸後的甘甜、綿密細緻的口感）。

                            【職人堅持】：使用條列點（•）描述食材來源（如在地小農、職人烘焙、天然無添加）與手作工藝的堅持。

                            【品嚐建議】：提供最佳享用方式（如：建議先啜吸一口原味、建議搭配的甜點或飲品）。

                            【產品資訊】：飲品容量（皆為500ml）或甜點份量（蛋糕類皆為切片）、食材過敏原提醒等，並特別標註圖片僅供參考。

                            請使用台灣咖啡廳、文藝社群風格常用詞彙（如「日常」、「溫潤」、「餘韻」、「手作」、「靜謐」），並在 detail 中適當換行以確保良好的閱讀體驗。`,
              },
              {
                role: "user",
                content: `品名: ${nameEl.value}, 售價: ${priceEl.value}, 產品關鍵字: ${keysEl.value}`,
              },
            ],
            response_format: { type: "json_object" },
          }),
        },
      );

      if (!response.ok)
        throw new Error(`HTTP 錯誤！狀態碼: ${response.status}`);

      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content);

      document.getElementById("resTitle").textContent = result.title;
      document.getElementById("resPrice").textContent = `NT$ ${result.price}`;
      document.getElementById("resDesc").innerHTML = result.detail;

      if (resultArea) {
        resultArea.style.display = "block";
        resultArea.style.opacity = 0;
        let opacity = 0;
        const timer = setInterval(() => {
          if (opacity >= 1) clearInterval(timer);
          resultArea.style.opacity = opacity;
          opacity += 0.1;
        }, 30);
      }

      // 暫存到 localStorage
      localStorage.setItem("pending_product", JSON.stringify(result));
    } catch (err) {
      alert("AI 生成失敗，請檢查網路狀況或 API Key");
      console.error("詳細錯誤資訊:", err);
    } finally {
      // 5. 恢復 UI 狀態
      if (spinner) spinner.style.display = "none";
      if (btnText) btnText.textContent = "開始 AI 生成內容";
      btnGen.disabled = false;
    }
  });
});

document.getElementById("btn-confirm").addEventListener("click", () => {
  // 跳轉到上架頁面
  window.location.href = "product_upload.html";
});
