import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const adminEmails = ["moonlightcafe.com@gmail.com"]; // 商家管理帳號

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



// 頁面初始化與標籤功能
window.addEventListener('load', () => {
    // 標籤點擊
    document.body.addEventListener('click', function (event) {
        if (event.target.classList.contains('preset-tag')) {
            const tagInput = document.getElementById('pKeywords');
            if (!tagInput) return;

            const tagName = event.target.innerText.trim();
            const separator = '、';
            let currentVal = tagInput.value.trim();

            if (currentVal === "") {
                tagInput.value = tagName;
            } else {
                let tagsArray = currentVal.split(/[、,]/).map(t => t.trim());
                if (!tagsArray.includes(tagName)) {
                    tagsArray.push(tagName);
                    tagInput.value = tagsArray.join(separator);
                }
            }
            tagInput.focus();
        }
    });

    // 讀取 AI 暫存資料
    const rawData = localStorage.getItem('pending_product');
    if (rawData) {
        const data = JSON.parse(rawData);
        document.getElementById('pName').value = data.title || "";
        document.getElementById('pPrice').value = data.price || "";
        document.getElementById('pDesc').value = data.detail || "";

        const tagInput = document.getElementById('pKeywords');
        if (data.keywords) {
            if (Array.isArray(data.keywords)) {
                // 如果是陣列，用「、」接起來
                tagInput.value = data.keywords.join('、');
            } else {
                // 如果已經是字串，直接填入
                tagInput.value = data.keywords;
            }
        }

        // 處理圖片預覽
        if (data.isEditMode && data.oldImageUrls && data.oldImageUrls.length > 0) {
            const area = document.getElementById('previewArea');
            area.innerHTML = '';
            data.oldImageUrls.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.className = 'preview-img';
                img.style.opacity = '0.7';
                area.appendChild(img);
            });
            const tip = document.createElement('div');
            tip.className = 'small text-white w-100 ml-2';
            tip.innerHTML = '⚠️ 若需更換圖片，請點選「選擇檔案」重新上傳。';
            area.appendChild(tip);
        }

        // 模式切換邏輯
        const notifyBox = document.getElementById('aiNotify');
        const cancelBtn = document.getElementById('btn-cancel-edit');
        if (data.isEditMode) {
            notifyBox.className = "alert alert-info ai-badge shadow-sm";
            notifyBox.innerHTML = `🛠️ <strong>修改模式： 正在編輯商品「${data.title}」。</strong>`;
            if (cancelBtn) {
                cancelBtn.style.display = 'block';
                cancelBtn.onclick = () => {
                    if (confirm("確定要放棄修改並返回商品清單嗎？")) {
                        localStorage.removeItem('pending_product');
                        window.location.href = "product_list.html";
                    }
                };
            }
        } else {
            notifyBox.style.display = 'block';
        }
        notifyBox.style.display = 'block';
    }
});

// 圖片預覽功能
document.getElementById('pImages').addEventListener('change', function (e) {
    const area = document.getElementById('previewArea');
    area.innerHTML = '';
    [...e.target.files].forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = document.createElement('img');
            img.src = ev.target.result;
            img.className = 'preview-img';
            area.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
    const label = e.target.nextElementSibling;
    if (label) label.innerText = e.target.files.length + " 個檔案已選取";
});

//提交到 Firebase
document.getElementById('btn-submit').addEventListener('click', async () => {
    const name = document.getElementById('pName').value;
    const price = document.getElementById('pPrice').value;
    const files = document.getElementById('pImages').files;
    const keywordsRaw = document.getElementById('pKeywords').value;

    if (!name || !price || !keywordsRaw) return alert("資料不完整無法上傳");

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.innerText = "正在儲存...";

    try {
        const rawData = localStorage.getItem('pending_product');
        const editInfo = rawData ? JSON.parse(rawData) : null;
        let imageUrls = [];

        if (files.length > 0) {
            for (const file of files) {
                const sRef = ref(storage, `products/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(sRef, file);
                const url = await getDownloadURL(snapshot.ref);
                imageUrls.push(url);
            }
        } else if (editInfo && editInfo.oldImageUrls) {
            imageUrls = editInfo.oldImageUrls;
        }

        const productData = {
            name: name,
            price: Number(price),
            description: document.getElementById('pDesc').value,
            keywords: keywordsRaw ? keywordsRaw.split('、').map(k => k.trim()) : [],
            imageUrls: imageUrls,
            updatedAt: serverTimestamp()
        };

        if (editInfo && editInfo.isEditMode && editInfo.docId) {
            await updateDoc(doc(db, "products", editInfo.docId), productData);
            alert("✅ 修改成功");
        } else {
            productData.createdAt = serverTimestamp();
            await addDoc(collection(db, "products"), productData);
            alert("✅ 新增成功");
        }

        localStorage.removeItem('pending_product');
        window.location.href = "product_list.html";
    } catch (err) {
        alert("儲存失敗：" + err.message);
        btn.disabled = false;
        btn.innerText = "確認資料並發布上架";
    }
});

window.addEventListener('pagehide', () => {
    localStorage.removeItem('pending_product');
});