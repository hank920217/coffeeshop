import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, addDoc, onSnapshot, doc }
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

/* ========= 標籤優先順序 (數值越小越前面) ========= */
const TAG_PRIORITY = {
  "coffee": 1,
  "TeaLatteSelection": 2,
  "Chocolate": 3,
  "SparklingSoda": 4,
  "TaiwaneseSpecialities": 5,
  "CaffeineFree": 6,
  "dessert": 7,
  "peripheralproducts": 8
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

    // --- 依照標籤優先權排序商品 ---
    allItems.sort((a, b) => {
      const getPriority = (item) => {
        if (!item.keywords || item.keywords.length === 0) return 99;
        // 找出該商品所有標籤中，優先權數值最小 (最優先) 的
        const priorities = item.keywords.map(k => TAG_PRIORITY[k] || 99);
        return Math.min(...priorities);
      };

      const pA = getPriority(a);
      const pB = getPriority(b);
      
      if (pA !== pB) return pA - pB;
      // 優先權相同時，維持原本時間排序 (不做額外處理)
      return 0;
    });
    // ---------------------------

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

  // 依照優先權排序標籤按鈕
  const sortedTags = tags.sort((a, b) => {
    const pA = TAG_PRIORITY[a] || 99;
    const pB = TAG_PRIORITY[b] || 99;
    
    if (pA !== pB) return pA - pB;
    // 優先權相同時，用字母排序確保順序固定
    return a.localeCompare(b);
  });

  sortedTags.forEach(tag => {
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

    const card = document.createElement("div");
    card.className = "menu-item";

    card.innerHTML = `
      <div class="menu-img-container">
        <img src="${imgUrl}" alt="${item.name}" class="menu-img-square" loading="lazy">
      </div>
      <div class="menu-info">
        <h3>${item.name}</h3>
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

  // 綁定加入購物車按鈕
  const addBtn = document.getElementById("modalAddBtn");
  if (addBtn) {
    addBtn.onclick = () => {
      addToCart(item);
      // 簡單的視覺回饋
      const originalText = addBtn.innerText;
      addBtn.innerText = "已加入！";
      setTimeout(() => addBtn.innerText = originalText, 1000);
    };
  }

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
  
  // 更新紅點不用 alert
  updateCartBadge();
  
  // 讓紅點跳一下
  const badge = document.querySelector(".cart-badge");
  if(badge) {
    badge.classList.add("bump");
    setTimeout(() => badge.classList.remove("bump"), 200);
  }
}

/* ========= 購物車紅點 (Global) ========= */
function updateCartBadge() {
  const cartLink = document.querySelector('a[href="cart.html"]');
  if (!cartLink) return;

  let cart = JSON.parse(localStorage.getItem("coffeeCart")) || [];
  const totalQty = cart.reduce((sum, item) => sum + (item.qty || 1), 0);

  let badge = cartLink.querySelector(".cart-badge");
  
  if (totalQty > 0) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "cart-badge";
      cartLink.appendChild(badge);
    }
    badge.innerText = totalQty;
    badge.style.display = "flex";
  } else {
    if (badge) {
      badge.style.display = "none";
    }
  }
}

// 頁面載入時初始化紅點
updateCartBadge();

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
          <h4>${item.name} <span class="item-qty-display">x ${qty}</span></h4>
          <p>單價: NT$ ${item.price} / 總計: NT$ ${subtotal}</p>
        </div>
      </div>
      <div class="cart-item-note">
        <input type="text" placeholder="備註 (例: 去冰、半糖)" value="${item.note || ''}" data-idx="${index}">
      </div>
      <div class="cart-item-actions">
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
  updateCartBadge(); // 同步更新紅點
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
  updateCartBadge(); // 同步更新紅點
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

async function submitOrder(cart) {
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


  // 3. 準備訂單資料
  const simplifiedItems = cart.map(item => ({
    name: item.name,
    price: Number(item.price),
    qty: item.qty || 1,
    note: item.note || ""
  }));

  const totalAmount = cart.reduce((sum, item) => sum + (Number(item.price) * (item.qty || 1)), 0);

  const orderData = {
    customer: {
      name: name,
      phone: phone
    },
    items: simplifiedItems,
    total: Number(totalAmount),
    order_status: 1, // 1: 餐廳已收到訂單
    timestamp: Date.now() // 改用數值 (毫秒) 以利後端排序
  };

  try {
    // 4. 傳送至 Firestore
    // 使用 addDoc 自動生成文件 ID，並將 orderData 寫入 "cafe_orders" 集合
    const docRef = await addDoc(collection(db, "cafe_orders"), orderData);
    
    alert(`訂單已成功送出！\n總金額: $${totalAmount}`);

    // 5. 清空購物車與輸入框
    localStorage.removeItem("coffeeCart");
    renderCart(); // 這會清空列表，總金額歸零
    updateCartBadge(); // 更新紅點為 0
    
    // 清空輸入框
    if(nameInput) nameInput.value = "";
    if(phoneInput) phoneInput.value = "";

    // 6. 啟動即時監聽 (取代原本的模擬)
    listenToOrder(docRef.id);

  } catch (e) {
    console.error("Error adding document: ", e);
    alert("訂單送出失敗，請檢查網路連線或稍後再試。");
  }
}

/* ========= 訂單進度視窗 ========= */
const ORDER_STATUSES = {
  0: "訂單已取消",
  1: "餐廳已收到訂單",
  2: "餐點製作中",
  3: "請前往取餐"
};

function listenToOrder(docId) {
  createPopupIfNotExist();
  const popup = document.getElementById("orderStatusPopup");

  // 先顯示初始狀態
  updateOrderStatusUI(1);
  popup.classList.add("active");

  // 開始監聽 Firestore 文件變化
  const unsub = onSnapshot(doc(db, "cafe_orders", docId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const status = data.order_status !== undefined ? data.order_status : 1;
      
      // 更新 UI，並傳入取消訂閱的 function
      updateOrderStatusUI(status, unsub);
    }
  });
}

function createPopupIfNotExist() {
  if (!document.getElementById("orderStatusPopup")) {
    const popup = document.createElement("div");
    popup.id = "orderStatusPopup";
    popup.className = "order-status-popup";
    document.body.appendChild(popup);
  }
}

function updateOrderStatusUI(code, unsubscribeFn) {
  const popup = document.getElementById("orderStatusPopup");
  if (!popup) return;

  const msg = ORDER_STATUSES[code] || "處理中...";
  const progressPercent = (code === 0) ? 100 : (code / 3) * 100;

  // 根據狀態決定是否顯示按鈕 (0:取消, 3:完成)
  let btnHtml = "";
  if (code === 0 || code === 3) {
    btnHtml = `<button id="popupConfirmBtn" style="
      margin-top:10px; 
      padding:6px 12px; 
      border:none; 
      border-radius:4px; 
      background:#3e2f25; 
      color:#fff; 
      cursor:pointer;">
      確認關閉
    </button>`;
  }

  popup.innerHTML = `
    <div class="order-status-title">
      <span class="status-icon"></span>
      目前訂單進度
    </div>
    <div class="order-status-msg">${msg}</div>
    <div class="progress-bar-container">
      <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
    </div>
    ${btnHtml}
  `;

  // 綁定按鍵事件
  const btn = popup.querySelector("#popupConfirmBtn");
  if (btn) {
    btn.onclick = () => {
      popup.classList.remove("active");
      if (typeof unsubscribeFn === 'function') {
        unsubscribeFn(); // 停止監聽
      }
    };
  }

  // 樣式調整
  const icon = popup.querySelector(".status-icon");
  const bar = popup.querySelector(".progress-bar-fill");
  
  if (code === 0) {
    if(icon) icon.style.background = "#999";
    if(bar) bar.style.background = "#999";
  } else {
    // 恢復正常顏色 (因為是 innerHTML 重繪，預設就是 CSS 的顏色，不需特別改回，除非之前是用 style 改的)
    // 這裡我們都重繪了，所以不用擔心殘留樣式
  }
}