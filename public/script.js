// ราคาสินค้า (จะถูกโหลดจาก API)
let prices = {};

// ชื่อสินค้า (จะถูกโหลดจาก API)
let itemNames = {};

// โหลดการตั้งค่าจาก API
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();

        // ตรวจสอบว่าร้านเปิดหรือไม่
        if (!settings.shopOpen) {
            showClosedMessage();
            return;
        }

        // โหลดเมนู
        if (settings.menu && settings.menu.length > 0) {
            loadMenu(settings.menu);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// แสดงข้อความร้านปิด
function showClosedMessage() {
    const menuSection = document.querySelector('.menu-items');
    const customerInfo = document.querySelector('.customer-info');
    const summarySection = document.querySelector('.order-summary');

    if (menuSection) {
        menuSection.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #fff3cd; border-radius: 15px;">
                <h3 style="color: #856404;">🔒 ร้านปิดชั่วคราว</h3>
                <p style="color: #856404; margin-top: 10px;">ขออภัย ขณะนี้ร้านปิดให้บริการชั่วคราว</p>
                <p style="color: #856404;">กรุณาลองใหม่อีกครั้งในภายหลัง</p>
            </div>
        `;
    }

    if (customerInfo) {
        customerInfo.style.display = 'none';
    }

    if (summarySection) {
        summarySection.style.display = 'none';
    }
}

// โหลดเมนู
function loadMenu(menuItems) {
    const menuContainer = document.querySelector('.menu-items');
    if (!menuContainer) return;

    // ล้างเมนูเก่า
    menuContainer.innerHTML = '';

    // สร้างเมนูใหม่
    menuItems.forEach(item => {
        prices[item.id] = item.price;
        itemNames[item.id] = item.name;

        const menuItemDiv = document.createElement('div');
        menuItemDiv.className = 'menu-item';
        menuItemDiv.innerHTML = `
            <div class="item-info">
                <h4>${item.name}</h4>
                <p class="price">${item.price} บาท</p>
            </div>
            <div class="quantity-control">
                <button class="btn-minus" onclick="changeQuantity('${item.id}', -1)">-</button>
                <input type="number" id="${item.id}-qty" value="0" min="0" readonly>
                <button class="btn-plus" onclick="changeQuantity('${item.id}', 1)">+</button>
            </div>
        `;
        menuContainer.appendChild(menuItemDiv);
    });

    updateSummary();
}

// เปลี่ยนจำนวนสินค้า
function changeQuantity(item, change) {
    const input = document.getElementById(`${item}-qty`);
    let currentValue = parseInt(input.value);
    let newValue = currentValue + change;

    if (newValue < 0) newValue = 0;

    input.value = newValue;
    updateSummary();
}

// อัพเดทสรุปรายการ
function updateSummary() {
    const summaryDiv = document.getElementById('summary-items');
    const totalPriceSpan = document.getElementById('total-price');

    summaryDiv.innerHTML = '';
    let total = 0;

    for (let item in prices) {
        const qty = parseInt(document.getElementById(`${item}-qty`).value);
        if (qty > 0) {
            const itemTotal = qty * prices[item];
            total += itemTotal;

            const summaryItem = document.createElement('div');
            summaryItem.className = 'summary-item';
            summaryItem.innerHTML = `
                <span>${itemNames[item]} x ${qty}</span>
                <span>${itemTotal} บาท</span>
            `;
            summaryDiv.appendChild(summaryItem);
        }
    }

    totalPriceSpan.textContent = total;
}

// แสดง/ซ่อนฟิลด์ที่อยู่
function toggleAddressField() {
    const deliveryType = document.getElementById('delivery-type').value;
    const addressGroup = document.getElementById('address-group');

    if (deliveryType === 'delivery') {
        addressGroup.style.display = 'block';
    } else {
        addressGroup.style.display = 'none';
    }
}

// สั่งซื้อ
function placeOrder() {
    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const deliveryType = document.getElementById('delivery-type').value;
    const deliveryTime = document.getElementById('delivery-time').value;
    const address = document.getElementById('customer-address').value.trim();
    const note = document.getElementById('customer-note').value.trim();

    // ตรวจสอบข้อมูล
    if (!name) {
        alert('กรุณาใส่ชื่อ');
        return;
    }

    if (!phone) {
        alert('กรุณาใส่เบอร์โทร');
        return;
    }

    if (!deliveryTime) {
        alert('กรุณาเลือกเวลาที่ต้องการรับ');
        return;
    }

    // ตรวจสอบที่อยู่ถ้าเลือกจัดส่ง
    if (deliveryType === 'delivery' && !address) {
        alert('กรุณาใส่ที่อยู่จัดส่งหรือลิงก์ Google Map');
        return;
    }

    // รวบรวมรายการสั่งซื้อ
    const orderItems = [];
    let total = 0;

    for (let item in prices) {
        const qty = parseInt(document.getElementById(`${item}-qty`).value);
        if (qty > 0) {
            const itemTotal = qty * prices[item];
            total += itemTotal;
            orderItems.push({
                name: itemNames[item],
                quantity: qty,
                price: prices[item],
                total: itemTotal
            });
        }
    }

    if (orderItems.length === 0) {
        alert('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ');
        return;
    }

    // สร้างข้อมูลออเดอร์
    const orderData = {
        customerName: name,
        customerPhone: phone,
        deliveryType: deliveryType,
        deliveryTime: deliveryTime,
        deliveryAddress: deliveryType === 'delivery' ? address : 'รับเองที่ร้าน อิหล่าปลาเผา (หน้าร้านทองเยาวราชนำโชค)',
        note: note,
        items: orderItems,
        total: total,
        orderTime: new Date().toLocaleString('th-TH')
    };

    // เก็บข้อมูลใน localStorage
    localStorage.setItem('currentOrder', JSON.stringify(orderData));

    // ไปหน้าชำระเงิน
    window.location.href = 'payment.html';
}

// โหลดการตั้งค่าและเมนูเมื่อเริ่มต้น
loadSettings();
