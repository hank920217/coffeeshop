import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const TAG_MAP = {
  peripheralproducts: "周邊商品",
  Chocolate: "巧克力飲品",
  coffee: "咖啡",
  dessert: "甜點",
  TeaLatteSelection: "茶與拿鐵",
  CaffeineFree: "無咖啡因飲品",
  SparklingSoda: "氣泡飲品",
  TaiwaneseSpecialities: "台灣特色飲品"
};

const firebaseConfig = {
  apiKey: "AIzaSyAEKrtUed8tzL1s072W9eWrTfT1RXfkOKA",
  authDomain: "test01-dd13e.firebaseapp.com",
  projectId: "test01-dd13e",
  storageBucket: "test01-dd13e.firebasestorage.app",
  messagingSenderId: "262581605790",
  appId: "1:262581605790:web:456fcca5091299e285728f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let allItems = [];
let activeTag = null;

// DOM Elements
const grid = document.getElementById("menuGrid");
const tagFilter = document.getElementById("tagFilter");
const modal = document.getElementById("productModal");
const cartList = document.getElementById("cartList");
const totalPriceEl = document.getElementById("totalPrice");

/* ========= 你的頁面判斷 ========= */
// 如果有 menuGrid，代表在 Menu 頁面
if (grid) {
  fetchMenu();
  setupModalEvents();
}

// 如果有 cartList，代表在 Cart 頁面
if (cartList) {
  renderCart();
}

/* ========= 抓資料 (Menu) ========= */
async function fetchMenu() {
  try {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    allItems = [];
    const tagSet = new Set();

    snapshot.forEach(doc => {
      const item = doc.data();
      allItems.push(item);
      (item.keywords || []).forEach(k => tagSet.add(k));
    });

    renderTags([...tagSet]);
    renderMenu(allItems);

  } catch (err) {
    console.error(err);
    grid.innerHTML = "菜單載入失敗，請稍後再試";
  }
}

/* ========= 產生標籤 (Menu) ========= */
function renderTags(tags) {
  if (!tagFilter) return;
  tagFilter.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.textContent = "全部";
  allBtn.style.margin = "5px";
  allBtn.classList.add("active"); // 預設全部
  allBtn.onclick = () => {
    activeTag = null;
    document.querySelectorAll("#tagFilter button").forEach(b => b.classList.remove("active"));
    allBtn.classList.add("active");
    renderMenu(allItems);
  };
  tagFilter.appendChild(allBtn);

  tags.forEach(tag => {
    const btn = document.createElement("button");
    btn.textContent = `#${TAG_MAP[tag] || tag}`;
    btn.style.margin = "5px";

    btn.onclick = () => {
      activeTag = tag;
      document.querySelectorAll("#tagFilter button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const filtered = allItems.filter(item =>
        (item.keywords || []).includes(tag)
      );
      renderMenu(filtered);
    };
    tagFilter.appendChild(btn);
  });
}

/* ========= 渲染卡片 (Menu) ========= */
function renderMenu(items) {
  if (!grid) return;
  grid.innerHTML = "";

  if (items.length === 0) {
    grid.innerHTML = "沒有符合的商品";
    return;
  }

  items.forEach(item => {
    const imgUrl = item.imageUrls?.[0] || "https://via.placeholder.com/300";

    // 截斷介紹文字 (如果不做 JS 截斷，也可以用 CSS line-clamp)
    // 這裡示範簡單的 JS 截斷供參考，但 CSS 更理想
    // let desc = item.description || "";
    // if (desc.length > 50) desc = desc.slice(0, 50) + "...more";

    const card = document.createElement("div");
    card.className = "menu-item";

    // 注意: 按鈕點擊事件要避免觸發卡片點擊 (stopPropagation)
    card.innerHTML = `
      <div class="menu-img-container">
        <img src="${imgUrl}" alt="${item.name}" class="menu-img-square" loading="lazy">
      </div>
      <div class="menu-info">
        <h3>${item.name}</h3>
        <p class="menu-desc">${item.description || ""}</p>
        <p class="menu-price">NT$ ${item.price}</p>
        <button class="btn-add-cart">加入購物車</button>
      </div>
    `;

    // 點擊卡片 -> 開 Modal
    card.addEventListener("click", (e) => {
      openModal(item);
    });

    // 點擊加入購物車 -> 阻擋冒泡，直接加
    const addBtn = card.querySelector(".btn-add-cart");
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart(item);
    });

    grid.appendChild(card);
  });
}

/* ========= Modal (Menu) ========= */
function setupModalEvents() {
  if (!modal) return;
  const closeBtn = document.getElementById("modalClose");

  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", e => {
    if (e.target === modal) closeModal();
  });
}

function openModal(item) {
  if (!modal) return;
  document.getElementById("modalImg").src = item.imageUrls?.[0] || "https://via.placeholder.com/300";
  document.getElementById("modalTitle").innerText = item.name;
  document.getElementById("modalPrice").innerText = `NT$ ${item.price}`;
  document.getElementById("modalDesc").innerHTML = (item.description || "").replace(/\n/g, "<br>");

  // Modal 裡也可以有一個加入購物車
  // 這裡先不加，維持原需求：浮現卡片左邊圖片右邊文字
  // 若想加，可以在 modal-text 裡塞一個按鈕

  modal.classList.add("active");
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove("active");
}

/* ========= 購物車邏輯 (Common) ========= */
function addToCart(item) {
  // 從 localStorage 讀取
  let cart = JSON.parse(localStorage.getItem("coffeeCart")) || [];

  // 檢查是否已存在 (以名稱判斷)
  const existingItem = cart.find(c => c.name === item.name);

  if (existingItem) {
    existingItem.qty = (existingItem.qty || 1) + 1;
  } else {
    // 只存需要的欄位，避免太雜
    cart.push({
      name: item.name,
      price: item.price,
      imageUrls: item.imageUrls,
      qty: 1,
      note: ""
    });
  }

  localStorage.setItem("coffeeCart", JSON.stringify(cart));
  alert(`已加入購物車：${item.name} (目前數量: ${existingItem ? existingItem.qty : 1})`);
}

/* ========= 渲染購物車 (Cart Page) ========= */
function renderCart() {
  if (!cartList) return;
  cartList.innerHTML = "";

  let cart = JSON.parse(localStorage.getItem("coffeeCart")) || [];

  if (cart.length === 0) {
    cartList.innerHTML = "<p>購物車是空的，快去選購吧！</p>";
    updateTotal(0);
    return;
  }

  let total = 0;

  cart.forEach((item, index) => {
    const qty = item.qty || 1;
    const subtotal = Number(item.price) * qty;
    total += subtotal;

    const row = document.createElement("div");
    row.className = "cart-item";

    // 圖片、名稱、價格、數量、備註input、刪除紐
    row.innerHTML = `
      <div class="cart-item-info">
        <img src="${item.imageUrls?.[0] || 'https://via.placeholder.com/100'}" alt="${item.name}">
        <div>
          <h4>${item.name} <span style="font-size:0.9em; color:#8b5e3c;">x ${qty}</span></h4>
          <p>單價: NT$ ${item.price} / 總計: NT$ ${subtotal}</p>
        </div>
      </div>
      <div class="cart-item-note">
        <input type="text" placeholder="備註 (例: 去冰、半糖)" value="${item.note || ''}" data-idx="${index}">
      </div>
      <div style="display:flex; flex-direction:column; gap:5px; align-items:flex-end;">
        <div class="qty-controls">
           <button class="btn-qty" onclick="updateQty(${index}, -1)">-</button>
           <button class="btn-qty" onclick="updateQty(${index}, 1)">+</button>
        </div>
        <button class="btn-remove" data-idx="${index}">移除</button>
      </div>
    `;
    cartList.appendChild(row);
  });

  updateTotal(total);
  setupCartEvents(cart);
}

// 供 HTML inline onclick 呼叫 (也可以用 addEventListener 綁定，但 inline 簡單點)
window.updateQty = function(index, change) {
  let cart = JSON.parse(localStorage.getItem("coffeeCart")) || [];
  if (cart[index]) {
    cart[index].qty = (cart[index].qty || 1) + change;
    if (cart[index].qty <= 0) {
       // 數量 <= 0 是否要移除? 或是停在 1? 這裡邏輯設為移除
       if(confirm("確定要移除此商品嗎？")) {
         cart.splice(index, 1);
       } else {
         cart[index].qty = 1;
       }
    }
  }
  localStorage.setItem("coffeeCart", JSON.stringify(cart));
  renderCart();
};

function setupCartEvents(cart) {
  // 監聽備註輸入 -> 更新 localStorage
  const inputs = cartList.querySelectorAll("input");
  inputs.forEach(input => {
    input.addEventListener("change", (e) => {
      const idx = e.target.dataset.idx;
      cart[idx].note = e.target.value;
      localStorage.setItem("coffeeCart", JSON.stringify(cart));
    });
  });

  // 移除按鈕
  const removeBtns = cartList.querySelectorAll(".btn-remove");
  removeBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      if(confirm("確定要刪除品項？")) {
        const idx = e.target.dataset.idx;
        cart.splice(idx, 1);
        localStorage.setItem("coffeeCart", JSON.stringify(cart));
        renderCart(); // 重繪
      }
    });
  });

  // 送出訂單
  const submitBtn = document.getElementById("submitOrderBtn");
  if (submitBtn) {
    submitBtn.onclick = () => submitOrder(cart);
  }
}

function updateTotal(amount) {
  if (totalPriceEl) {
    totalPriceEl.innerText = `總金額：NT$ ${amount}`;
  }
}

function submitOrder(cart) {
  if (cart.length === 0) {
    alert("購物車是空的無法送出");
    return;
  }

  // 1. 驗證客戶資訊
  const nameInput = document.getElementById("custName");
  const phoneInput = document.getElementById("custPhone");
  
  const name = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";

  if (!name || !phone) {
    alert("請輸入姓名與電話才能送出訂單！");
    return;
  }

  // 驗證電話格式 (09開頭, 10位數)
  const phoneRegex = /^09\d{8}$/;
  if (!phoneRegex.test(phone)) {
    alert("電話號碼格式錯誤！必須是 09 開頭的 10 位數字。");
    return;
  }

  // 2. 產生訂單編號 (0~500 循環)
  // 取得目前的編號，預設從 -1 開始，這樣第一筆會是 0
  let currentId = parseInt(localStorage.getItem("lastOrderId") || "-1");
  let newId = currentId + 1;
  
  if (newId > 500) {
    newId = 0;
  }
  
  localStorage.setItem("lastOrderId", newId.toString());

  // 3. 準備訂單資料
  // 簡化回傳資訊
  const simplifiedItems = cart.map(item => ({
    name: item.name,
    price: Number(item.price),
    qty: item.qty || 1,
    note: item.note || ""
  }));

  const totalAmount = cart.reduce((sum, item) => sum + (Number(item.price) * (item.qty || 1)), 0);

  const orderData = {
    orderId: newId,
    customer: {
      name: name,
      phone: phone
    },
    items: simplifiedItems,
    total: totalAmount,
    timestamp: new Date().toISOString()
  };

  console.log("送出訂單 JSON:", JSON.stringify(orderData, null, 2));
  alert(`訂單 #${newId} 已送出！\n總金額: $${totalAmount}\n(請查看 Console 模擬後端接收)`);

  // 4. 清空購物車與輸入框
  localStorage.removeItem("coffeeCart");
  // 不清除 lastOrderId，因為要累加
  renderCart(); // 這會清空列表，總金額歸零
  
  // 清空輸入框 (renderCart 會重繪整個 list 區域但 summary 是靜態的嗎? 
  // 檢查 HTML 結構: .cart-summary 在 .cart-container 裡，renderCart 只清空 #cartList
  // 所以我們要手動清空 input
  if(nameInput) nameInput.value = "";
  if(phoneInput) phoneInput.value = "";
}