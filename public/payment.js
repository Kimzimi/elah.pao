// โหลดข้อมูลออเดอร์จาก localStorage
const orderData = JSON.parse(localStorage.getItem('currentOrder'));

if (!orderData) {
    alert('ไม่พบข้อมูลออเดอร์');
    window.location.href = 'index.html';
}

// แสดงรายละเอียดออเดอร์
function displayOrderDetails() {
    const orderItemsDiv = document.getElementById('order-items');
    const orderTotalSpan = document.getElementById('order-total');
    const customerNameSpan = document.getElementById('customer-name');
    const customerPhoneSpan = document.getElementById('customer-phone');
    const deliveryTypeSpan = document.getElementById('delivery-type');
    const deliveryTimeSpan = document.getElementById('delivery-time');
    const deliveryAddressSpan = document.getElementById('delivery-address');
    const deliveryAddressDisplay = document.getElementById('delivery-address-display');
    const paymentAmountSpan = document.getElementById('payment-amount');

    // แสดงรายการสินค้า
    orderData.items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'order-item';
        itemDiv.innerHTML = `
            <span>${item.name} x ${item.quantity}</span>
            <span>${item.total} บาท</span>
        `;
        orderItemsDiv.appendChild(itemDiv);
    });

    // แสดงยอดรวมและข้อมูลลูกค้า
    orderTotalSpan.textContent = `${orderData.total} บาท`;
    customerNameSpan.textContent = orderData.customerName;
    customerPhoneSpan.textContent = orderData.customerPhone;
    deliveryTypeSpan.textContent = orderData.deliveryType === 'pickup' ? 'รับเองที่ร้าน' : 'จัดส่ง';
    deliveryTimeSpan.textContent = orderData.deliveryTime + ' น.';
    deliveryAddressSpan.textContent = orderData.deliveryAddress;

    // แสดงที่อยู่เฉพาะเมื่อเลือกจัดส่ง
    if (orderData.deliveryType === 'pickup') {
        deliveryAddressDisplay.style.display = 'none';
    }

    paymentAmountSpan.textContent = orderData.total;
}

// แสดงตัวอย่างสลิป
document.getElementById('slip-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('slip-preview');
            preview.innerHTML = `
                <p style="color: #28a745; margin-bottom: 10px;">✅ เลือกไฟล์: ${file.name}</p>
                <img src="${e.target.result}" style="max-width: 200px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.2);">
            `;
        };
        reader.readAsDataURL(file);
    }
});

// ฟังก์ชันเหล่านี้ไม่ใช้แล้วเพราะใช้ QR Code จากรูปภาพแทน

// ยืนยันการชำระเงิน
async function confirmPayment() {
    const slipFile = document.getElementById('slip-file').files[0];

    if (!slipFile) {
        alert('กรุณาแนบสลิปการโอนเงิน');
        return;
    }

    const btn = document.querySelector('.btn-confirm');
    btn.disabled = true;
    btn.textContent = 'กำลังส่งออเดอร์...';

    try {
        // สร้าง FormData สำหรับส่งทั้งข้อมูลและไฟล์
        const formData = new FormData();
        formData.append('orderData', JSON.stringify(orderData));
        formData.append('slip', slipFile);

        // ส่งข้อมูลไปยัง backend
        const response = await fetch('/api/send-order', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // แสดงข้อความสำเร็จ
            document.getElementById('success-message').style.display = 'block';

            // ลบข้อมูลออเดอร์
            localStorage.removeItem('currentOrder');

            // เก็บ Order ID ไว้สำหรับตรวจสอบสถานะ
            localStorage.setItem('lastOrderId', result.orderId);

            // กลับไปหน้าแรกหลังจาก 3 วินาที
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
        } else {
            throw new Error(result.message || 'ส่งออเดอร์ไม่สำเร็จ');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการส่งออเดอร์: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'ยืนยันการชำระเงินและส่งออเดอร์';
    }
}

// กลับไปหน้าแรก
function goBack() {
    window.location.href = 'index.html';
}

// เรียกใช้ฟังก์ชันเมื่อโหลดหน้า
displayOrderDetails();
